const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createLogger, watchWindow } = require("./diagnostics");

const sink = () => {
  const lines = [];
  return {
    lines,
    out: {
      log: (l) => lines.push(l),
      warn: (l) => lines.push(l),
      error: (l) => lines.push(l),
    },
  };
};

test("a logger writes to the console and to its file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "log-"));
  const file = path.join(dir, "logs", "app.log");
  const { lines, out } = sink();
  const log = createLogger(file, out);
  log.info("started");
  log.error("boom");
  assert.equal(lines.length, 2);
  assert.match(lines[1], /ERROR boom/);
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /INFO started/);
  assert.match(text, /ERROR boom/);
});

test("an unwritable log file does not stop the console", () => {
  const { lines, out } = sink();
  // a folder that cannot exist: its parent is a file
  const blocker = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "log-")),
    "f",
  );
  fs.writeFileSync(blocker, "x");
  const log = createLogger(path.join(blocker, "x", "app.log"), out);
  log.warn("still here");
  assert.equal(lines.length, 1);
});

test("a window's page errors and failed loads are reported", () => {
  const { lines, out } = sink();
  const log = createLogger(null, out);
  const handlers = {};
  const window = {
    webContents: { on: (n, f) => (handlers[n] = f) },
    on: () => {},
  };
  watchWindow(log, window);
  // both Electron styles of console event
  handlers["console-message"]({
    level: "error",
    message: "bad",
    lineNumber: 3,
    sourceId: "app://x/a.js",
  });
  handlers["console-message"]({}, 2, "old style", 9, "app://x/b.js");
  handlers["console-message"]({ level: "info", message: "quiet" });
  handlers["did-fail-load"](
    {},
    -6,
    "ERR_FILE_NOT_FOUND",
    "app://excalidraw/",
    true,
  );
  handlers["render-process-gone"]({}, { reason: "crashed" });
  assert.equal(lines.length, 4);
  assert.match(lines[0], /page: bad \(a\.js:3\)/);
  assert.match(lines[1], /old style/);
  assert.match(lines[2], /failed to load/);
  assert.match(lines[3], /crashed/);
});
