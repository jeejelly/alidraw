// Excalidraw as a desktop window: the web build served from disk under app://excalidraw/,
// with every request that is not to that origin refused.
const path = require("node:path");

const { app } = require("electron");

const { createLogger, watchProcess } = require("./src/diagnostics");
const { registerScheme } = require("./src/webbuild");
const { runSingleInstance } = require("./src/startup");

// every start says what it does, on the console and in <userData>/logs/excalidraw.log
const log = createLogger(
  path.join(app.getPath("userData"), "logs", "excalidraw.log"),
);
watchProcess(log);

registerScheme();
runSingleInstance(log);
