// The web build served from disk under app://excalidraw/.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { app, net, protocol } = require("electron");

const SCHEME = "app";
const ORIGIN = `${SCHEME}://excalidraw`;
const ALLOWED_SCHEMES = new Set([`${SCHEME}:`, "data:", "blob:", "devtools:"]);

// packaged: resources/app; from the repo: the web build next door
const WEB_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, "app")
  : path.join(__dirname, "..", "..", "excalidraw-app", "build");

const WEB_ROOT_URL = pathToFileURL(WEB_ROOT + path.sep).toString();

/** Must run before the app is ready. */
const registerScheme = () =>
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

module.exports = { ORIGIN, WEB_ROOT, registerScheme, isLocal, serveWebBuild };
