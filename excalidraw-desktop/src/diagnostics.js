// What the desktop app says about itself: every line goes to the console and to a
// log file, so a start that fails is never silent.
const fs = require("node:fs");
const path = require("node:path");

const LEVELS = ["debug", "info", "warn", "error"];
const MAX_BYTES = 512 * 1024;

/** a logger writing to the console and (best effort) to `file`, kept small */
const createLogger = (file, out = console) => {
  const write = (level, message) => {
    const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
    (level === "error" ? out.error : level === "warn" ? out.warn : out.log)(
      line,
    );
    if (!file) {
      return;
    }
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) {
        fs.renameSync(file, `${file}.old`);
      }
      fs.appendFileSync(file, `${line}\n`);
    } catch {
      // the console still has it
    }
  };
  const log = Object.fromEntries(
    LEVELS.map((level) => [level, (m) => write(level, String(m))]),
  );
  log.file = file;
  return log;
};

const describe = (error) =>
  error && error.stack ? error.stack : String(error);

/** uncaught errors and rejected promises of the main process */
const watchProcess = (log, proc = process) => {
  proc.on("uncaughtException", (e) => log.error(`uncaught: ${describe(e)}`));
  proc.on("unhandledRejection", (e) =>
    log.error(`unhandled rejection: ${describe(e)}`),
  );
};

/** what a window's page prints, and how it fails */
const watchWindow = (log, window) => {
  const wc = window.webContents;
  // Electron 35+ passes one event object, older ones positional arguments
  wc.on("console-message", (...args) => {
    const first = args[0];
    const e =
      first && typeof first === "object" && "message" in first
        ? first
        : {
            level: args[1],
            message: args[2],
            lineNumber: args[3],
            sourceId: args[4],
          };
    const level =
      typeof e.level === "string"
        ? e.level
        : ["debug", "info", "warning", "error"][e.level] ?? "info";
    if (level === "warning" || level === "error") {
      log[level === "warning" ? "warn" : "error"](
        `page: ${e.message} (${String(e.sourceId || "")
          .split("/")
          .pop()}:${e.lineNumber})`,
      );
    }
  });
  wc.on("did-fail-load", (_e, code, description, url, isMainFrame) => {
    if (isMainFrame) {
      log.error(`page failed to load ${url}: ${description} (${code})`);
    }
  });
  wc.on("render-process-gone", (_e, details) =>
    log.error(`page process gone: ${JSON.stringify(details)}`),
  );
  wc.on("preload-error", (_e, file, error) =>
    log.error(`preload ${file}: ${describe(error)}`),
  );
  window.on("unresponsive", () => log.warn("window is not responding"));
};

module.exports = { createLogger, watchProcess, watchWindow };
