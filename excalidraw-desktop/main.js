// Excalidraw as a desktop window: the web build served from disk under app://excalidraw/,
// with every request that is not to that origin refused.
const { app, BrowserWindow, net, protocol, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

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
  // the File System Access API (open, save, autosave) asks through these
  const localOnly = (webContents) =>
    !!webContents && webContents.getURL().startsWith(ORIGIN);
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) =>
      callback(permission === "fileSystem" && localOnly(webContents)),
  );
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission) =>
      permission === "fileSystem" && localOnly(webContents),
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
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
