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
      origin.startsWith(ORIGIN) || (origin === "" && permission === "fileSystem");
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
      callback(
        decide(permission, originOf("", details, webContents), details),
      ),
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
