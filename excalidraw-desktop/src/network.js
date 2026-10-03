// Network and permission policy: nothing leaves the app, and only its own origin may ask.
const { session } = require("electron");

const { ORIGIN, isLocal } = require("./webbuild");

// Electron 44 calls the check handler with webContents null and, for some checks, an empty
// requestingOrigin (measured: media, geolocation, web-app-installation), so the origin is
// taken from whichever argument carries it.
const originOf = (requestingOrigin, details, webContents) =>
  requestingOrigin ||
  details?.requestingUrl ||
  details?.embeddingOrigin ||
  webContents?.getURL() ||
  "";

// Every permission the page asks for (file open, save and autosave through the File System
// Access API; clipboard) is granted to the app's own origin and to nothing else. Navigation
// and new windows are refused, so the only page that can ask is the app's own.
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

const refuseNetwork = () => {
  const { defaultSession } = session;
  defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const local = isLocal(details.url);
    if (!local) {
      console.warn(`excalidraw-desktop: refused ${details.url}`);
    }
    callback({ cancel: !local });
  });
  defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) =>
      callback(decide(permission, originOf("", details, webContents), details)),
  );
  defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) =>
      decide(
        permission,
        originOf(requestingOrigin, details, webContents),
        details,
      ),
  );
};

module.exports = { refuseNetwork };
