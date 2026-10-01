// Excalidraw as a desktop window: the web build served from disk under app://excalidraw/,
// with every request that is not to that origin refused.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const { execFile } = require("node:child_process");

const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
} = require("electron");

const git = require("./src/git");
const { AutoCommit } = require("./src/autocommit");
const { Backup } = require("./src/backup");
const { Secrets } = require("./src/secrets");
const { Registry } = require("./src/registry");
const { Sync } = require("./src/sync");
const { Workspaces } = require("./src/workspace");
const { resolveInside } = require("./src/paths");

const SCHEME = "app";
const ORIGIN = `${SCHEME}://excalidraw`;
const ALLOWED_SCHEMES = new Set([`${SCHEME}:`, "data:", "blob:", "devtools:"]);

// packaged: resources/app; from the repo: the web build next door
const WEB_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, "app")
  : path.join(__dirname, "..", "excalidraw-app", "build");

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      codeCache: true,
    },
  },
]);

const WEB_ROOT_URL = pathToFileURL(WEB_ROOT + path.sep).toString();

/** The page's own origin, inline data, and the build files app:// is served from. */
const isLocal = (url) => {
  try {
    return (
      ALLOWED_SCHEMES.has(new URL(url).protocol) || url.startsWith(WEB_ROOT_URL)
    );
  } catch {
    return false;
  }
};

const serveWebBuild = () => {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(
      path.join(WEB_ROOT, decodeURIComponent(pathname)),
    );
    // a path escaping the build directory is refused, not resolved
    if (!file.startsWith(WEB_ROOT + path.sep) && file !== WEB_ROOT) {
      return new Response("forbidden", { status: 403 });
    }
    const target =
      fs.existsSync(file) && fs.statSync(file).isFile()
        ? file
        : path.extname(pathname)
        ? null
        : path.join(WEB_ROOT, "index.html");
    if (!target) {
      return new Response("not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
};

const refuseNetwork = () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const local = isLocal(details.url);
    if (!local) {
      console.warn(`excalidraw-desktop: refused ${details.url}`);
    }
    callback({ cancel: !local });
  });
  // Every permission the page asks for (file open, save and autosave through the File System
  // Access API; clipboard) is granted to this app's own origin and to nothing else.
  // Electron 44 calls the check handler with webContents null and, for some checks, an empty
  // requestingOrigin (measured: media, geolocation, web-app-installation), so the origin is
  // taken from whichever argument carries it.
  const originOf = (requestingOrigin, details, webContents) =>
    requestingOrigin ||
    details?.requestingUrl ||
    details?.embeddingOrigin ||
    webContents?.getURL() ||
    "";
  // navigation and new windows are refused, so the only page that can ask is the app's own
  const decide = (permission, origin, details) => {
    const granted =
      origin.startsWith(ORIGIN) ||
      (origin === "" && permission === "fileSystem");
    if (permission === "fileSystem" || !granted) {
      console.warn(
        `excalidraw-desktop: ${granted ? "granted" : "denied"} ${permission} ` +
          `origin="${origin}" ${JSON.stringify(details ?? {})}`,
      );
    }
    return granted;
  };
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) =>
      callback(decide(permission, originOf("", details, webContents), details)),
  );
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) =>
      decide(
        permission,
        originOf(requestingOrigin, details, webContents),
        details,
      ),
  );
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Excalidraw",
    icon: path.join(WEB_ROOT, "android-chrome-512x512.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
    }
  });
  window.loadURL(`${ORIGIN}/`);
  return window;
};

// -----------------------------------------------------------------------------
// workspaces: named project folders, git-backed (see docs/specs, EXC-14)
// -----------------------------------------------------------------------------

let workspaces;
let autoCommit;
let registry;
let sync;
let secrets;
let backup;
const syncTimers = new Map();
// folders the user picked in a dialog; the page names them by token, never by path
const pickedFolders = new Map();

const broadcast = (data) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("ws:event", data);
  }
};

const GIT_HELP = {
  linux:
    "Install git with your package manager, for example: sudo apt install git",
  darwin: "Install git with: xcode-select --install",
  win32: "Install git from https://git-scm.com/download/win",
};

/** one handler: only the app's own page may ask, errors come back as values */
const handle = (channel, fn) =>
  ipcMain.handle(channel, async (event, payload) => {
    if (!event.senderFrame || !event.senderFrame.url.startsWith(ORIGIN)) {
      return { ok: false, error: "refused" };
    }
    try {
      return { ok: true, value: await fn(payload ?? {}, event) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

const takeFolder = (token) => {
  const folder = pickedFolders.get(token);
  if (!folder) {
    throw new Error("choose a folder first");
  }
  pickedFolders.delete(token);
  return folder;
};

const setupWorkspaces = () => {
  registry = new Registry(app.getPath("userData"));
  workspaces = new Workspaces({ registry });
  autoCommit = new AutoCommit({
    delayFor: (id) => {
      const s = workspaces.settings(id);
      return s.autoCommit ? Math.max(5, s.delaySec ?? 60) * 1000 : null;
    },
    onResult: (id, result) => {
      broadcast({ type: "commit", id, ...result });
      if (
        result.ok &&
        result.hash &&
        workspaces.settings(id).push === "afterCommit"
      ) {
        sync.sync(id).catch(() => {});
      }
    },
  });
  secrets = new Secrets(app.getPath("userData"));
  backup = new Backup({
    workspaces,
    registry,
    secrets,
    isPaused: () => registry.appSettings().paused === true,
    emit: broadcast,
  });
  sync = new Sync({
    workspaces,
    isPaused: () => registry.appSettings().paused === true,
    // only what the app itself saved is committed on the way to a push
    flush: (id) => (autoCommit.hasPending(id) ? autoCommit.flush(id) : null),
    emit: broadcast,
  });

  /** the timer of the "every N seconds" push policy */
  const schedule = (id) => {
    clearInterval(syncTimers.get(id));
    syncTimers.delete(id);
    const s = workspaces.settings(id);
    if (s.push === "interval") {
      const every = Math.min(86400, Math.max(30, s.syncEverySec ?? 300)) * 1000;
      syncTimers.set(
        id,
        setInterval(() => sync.sync(id).catch(() => {}), every),
      );
    }
  };
  for (const w of workspaces.list()) {
    schedule(w.id);
  }

  handle("ws:gitInfo", async () => {
    const v = await git.version();
    return {
      installed: !!v,
      version: v,
      help: GIT_HELP[process.platform] ?? GIT_HELP.linux,
    };
  });

  handle("ws:installGit", async (_args, event) => {
    if (await git.version()) {
      return { installed: true };
    }
    const canInstall =
      process.platform === "linux" &&
      fs.existsSync("/usr/bin/apt-get") &&
      fs.existsSync("/usr/bin/pkexec");
    if (!canInstall) {
      return {
        installed: false,
        help: GIT_HELP[process.platform] ?? GIT_HELP.linux,
      };
    }
    const window = BrowserWindow.fromWebContents(event.sender);
    const { response } = await dialog.showMessageBox(window, {
      type: "question",
      buttons: ["Install git", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      message: "Install git?",
      detail:
        "This runs: pkexec apt-get install -y git\nYou will be asked for your password.",
    });
    if (response !== 0) {
      return { installed: false, cancelled: true };
    }
    await new Promise((resolve, reject) =>
      execFile(
        "pkexec",
        ["apt-get", "install", "-y", "git"],
        { timeout: 600000 },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    return { installed: !!(await git.version()) };
  });

  handle("ws:pickFolder", async (_args, event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (canceled || !filePaths[0]) {
      return null;
    }
    const token = randomUUID();
    pickedFolders.set(token, filePaths[0]);
    return { token, display: filePaths[0] };
  });

  handle("ws:list", () => workspaces.list());
  handle("ws:create", ({ name, useGit, token }) =>
    workspaces.create({
      name,
      useGit: useGit !== false,
      parent: takeFolder(token),
    }),
  );
  handle("ws:open", ({ token, useGit }) =>
    workspaces.open(takeFolder(token), { useGit: useGit !== false }),
  );
  handle("ws:saveNew", ({ id, name, text, dir }) => {
    const rel = workspaces.saveNewScene(id, name, text, dir);
    autoCommit.touch(id, workspaces.root(id), rel);
    return { path: rel };
  });
  handle("ws:forget", ({ id }) => workspaces.forget(id));
  handle("ws:scenes", ({ id }) => {
    workspaces.touch(id);
    return workspaces.scenes(id);
  });
  handle("ws:read", ({ id, path: rel }) => workspaces.readScene(id, rel));
  handle("ws:write", ({ id, path: rel, text }) => {
    const result = workspaces.writeScene(id, rel, text);
    autoCommit.touch(id, workspaces.root(id), result.path);
    return result;
  });
  handle("ws:newScene", ({ id, name, dir }) =>
    workspaces.newScene(id, name, dir),
  );
  handle("ws:writeAsset", ({ id, mime, base64 }) => {
    const result = workspaces.writeAsset(id, mime, base64);
    // the file is committed with the scenes that refer to it, unless binaries live on the server
    if (workspaces.meta(id).binaries !== "server") {
      autoCommit.touch(id, workspaces.root(id), result.path);
    }
    backup.queue(id);
    return result;
  });
  handle("ws:readAsset", async ({ id, path: rel }) => {
    try {
      return workspaces.readAsset(id, rel);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      // not on this machine yet: the work server has it
      await backup.fetch(id, rel);
      return workspaces.readAsset(id, rel);
    }
  });
  handle("ws:secretsStatus", () => secrets.status());
  handle("ws:secretsUnlock", ({ passphrase }) => {
    if (secrets.status().exists) {
      secrets.unlock(passphrase);
    } else {
      secrets.create(passphrase);
    }
    // what was waiting for the passwords can go now
    for (const w of workspaces.list()) {
      backup.queue(w.id);
    }
    return secrets.status();
  });
  handle("ws:secretsLock", () => {
    secrets.lock();
    return secrets.status();
  });
  handle("ws:serverGet", ({ id }) => backup.publicConfig(id));
  handle("ws:serverSet", ({ id, server, password }) =>
    backup.setConfig(id, server, password),
  );
  handle("ws:serverTrust", ({ id, fingerprint }) =>
    backup.trustHostKey(id, fingerprint),
  );
  handle("ws:serverTest", ({ id }) => backup.test(id));
  handle("ws:backupNow", ({ id }) => backup.backupNow(id));
  handle("ws:fetchAll", ({ id }) => backup.fetchAll(id));
  handle("ws:keepOut", ({ id, on }) => backup.setKeepOut(id, on === true));
  handle("ws:meta", ({ id }) => workspaces.meta(id));
  handle("ws:setMeta", ({ id, meta }) => {
    const allowed = {};
    if (meta?.assets === "embedded" || meta?.assets === "linked") {
      allowed.assets = meta.assets;
    }
    return workspaces.setMeta(id, allowed);
  });
  handle("ws:getSettings", ({ id }) => workspaces.settings(id));
  handle("ws:setSettings", ({ id, settings }) => {
    const allowed = {};
    if (typeof settings?.autoCommit === "boolean") {
      allowed.autoCommit = settings.autoCommit;
    }
    if (["manual", "afterCommit", "interval"].includes(settings?.push)) {
      allowed.push = settings.push;
    }
    if (Number.isFinite(settings?.syncEverySec)) {
      allowed.syncEverySec = Math.min(
        86400,
        Math.max(30, Math.round(settings.syncEverySec)),
      );
    }
    if (typeof settings?.pullOnOpen === "boolean") {
      allowed.pullOnOpen = settings.pullOnOpen;
    }
    if (Number.isFinite(settings?.delaySec)) {
      allowed.delaySec = Math.min(
        3600,
        Math.max(5, Math.round(settings.delaySec)),
      );
    }
    const entry = workspaces.setSettings(id, allowed);
    schedule(id);
    return entry;
  });
  handle("ws:status", async ({ id }) => {
    const root = workspaces.root(id);
    if (!(await git.version())) {
      return { git: false };
    }
    if (!(await git.isRepo(root))) {
      return { git: true, repo: false };
    }
    return {
      git: true,
      repo: true,
      pending: autoCommit.hasPending(id),
      remote: await sync.remote(id),
      sync: sync.info(id),
      paused: registry.appSettings().paused === true,
      ...(await git.status(root)),
    };
  });
  handle("ws:remoteSet", ({ id, url }) => sync.setRemote(id, url));
  handle("ws:sync", ({ id, pull, push }) =>
    sync.sync(id, { pull: pull !== false, push: push !== false }),
  );
  handle("ws:resolve", ({ id, choice }) => sync.resolve(id, choice));
  handle("ws:setPaused", ({ paused }) =>
    registry.setAppSettings({ paused: paused === true }),
  );
  // a workspace became the one in use: pull what others pushed, if asked to
  handle("ws:activate", async ({ id }) => {
    workspaces.touch(id);
    backup.queue(id);
    if (
      workspaces.settings(id).pullOnOpen !== false &&
      (await sync.remote(id))
    ) {
      sync.sync(id, { push: false }).catch(() => {});
    }
  });
  handle("ws:commitNow", async ({ id, message }) => {
    const root = workspaces.root(id);
    const hash = await autoCommit.flush(
      id,
      root,
      typeof message === "string" && message.trim()
        ? message.trim()
        : "Update workspace",
    );
    return { hash };
  });
  handle("ws:history", ({ id, path: rel }) => {
    const root = workspaces.root(id);
    resolveInside(root, rel);
    return git.log(root, rel);
  });
  handle("ws:showVersion", ({ id, hash, path: rel }) => {
    const root = workspaces.root(id);
    resolveInside(root, rel);
    return git.showFile(root, hash, rel);
  });

  // what is waiting is committed before the app closes
  let closing = false;
  app.on("before-quit", (event) => {
    if (closing || !autoCommit) {
      return;
    }
    event.preventDefault();
    closing = true;
    autoCommit.flushAll().finally(() => app.quit());
  });
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });
  app.whenReady().then(() => {
    serveWebBuild();
    refuseNetwork();
    setupWorkspaces();
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
