const path = require("node:path");

const { BrowserWindow } = require("electron");

const { watchWindow } = require("./diagnostics");
const { ORIGIN, WEB_ROOT } = require("./webbuild");

const createWindow = (log) => {
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
      preload: path.join(__dirname, "..", "preload.js"),
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
    }
  });
  watchWindow(log, window);
  window.loadURL(`${ORIGIN}/`);
  return window;
};

module.exports = { createWindow };
