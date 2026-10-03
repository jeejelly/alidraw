// Single-instance lock and the start-up sequence, with failures reported on screen.
const fs = require("node:fs");
const path = require("node:path");

const { app, BrowserWindow, dialog } = require("electron");

const { registerIpcHandlers } = require("./ipc");
const { refuseNetwork } = require("./network");
const { createServices } = require("./services");
const { WEB_ROOT, serveWebBuild } = require("./webbuild");
const { createWindow } = require("./window");

const describeError = (error) => (error && error.message) || error;

/** A second launch focuses the running window, or opens one if an earlier start lost it. */
const focusRunningInstance = (log) => {
  const [window] = BrowserWindow.getAllWindows();
  if (window) {
    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
    return;
  }
  log.warn("started again with no window open, opening one");
  try {
    createWindow(log);
  } catch (error) {
    log.error(`could not open a window: ${error && error.stack}`);
    app.quit();
  }
};

const start = (log) => {
  log.info(
    `starting ${app.getName()} ${app.getVersion()} (electron ${
      process.versions.electron
    }), web build ${WEB_ROOT}, log ${log.file}`,
  );
  try {
    if (!fs.existsSync(path.join(WEB_ROOT, "index.html"))) {
      throw new Error(`no web build at ${WEB_ROOT} (run: yarn build:app)`);
    }
    serveWebBuild();
    refuseNetwork();
    registerIpcHandlers(createServices());
    createWindow(log);
    log.info("window opened");
  } catch (error) {
    // a start that fails says so, instead of leaving nothing on the screen
    log.error(`could not start: ${error && error.stack ? error.stack : error}`);
    dialog.showErrorBox(
      "Excalidraw could not start",
      `${describeError(error)}\n\nDetails: ${log.file}`,
    );
    app.quit();
  }
};

const runSingleInstance = (log) => {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("second-instance", () => focusRunningInstance(log));
  app.whenReady().then(() => start(log));
  app.on("window-all-closed", () => app.quit());
};

module.exports = { runSingleInstance };
