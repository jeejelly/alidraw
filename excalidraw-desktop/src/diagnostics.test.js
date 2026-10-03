import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, it } from "vitest";

const { createLogger, watchWindow } = require("./diagnostics");

const sink = () => {
  const lines = [];
  return {
    lines,
    out: {
      log: (line) => lines.push(line),
      warn: (line) => lines.push(line),
      error: (line) => lines.push(line),
    },
  };
};

it("a logger writes to the console and to its file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "log-"));
  const file = path.join(dir, "logs", "app.log");
  const { lines, out } = sink();
  const log = createLogger(file, out);
  log.info("started");
  log.error("boom");
  expect(lines.length).toBe(2);
  expect(lines[1]).toMatch(/ERROR boom/);
  const text = fs.readFileSync(file, "utf8");
  expect(text).toMatch(/INFO started/);
  expect(text).toMatch(/ERROR boom/);
});

it("an unwritable log file does not stop the console", () => {
  const { lines, out } = sink();
  // a folder that cannot exist: its parent is a file
  const blocker = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "log-")),
    "f",
  );
  fs.writeFileSync(blocker, "x");
  const log = createLogger(path.join(blocker, "x", "app.log"), out);
  log.warn("still here");
  expect(lines.length).toBe(1);
});

it("a window's page errors and failed loads are reported", () => {
  const { lines, out } = sink();
  const log = createLogger(null, out);
  const handlers = {};
  const window = {
    webContents: {
      on: (eventName, handler) => (handlers[eventName] = handler),
    },
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
  expect(lines.length).toBe(4);
  expect(lines[0]).toMatch(/page: bad \(a\.js:3\)/);
  expect(lines[1]).toMatch(/old style/);
  expect(lines[2]).toMatch(/failed to load/);
  expect(lines[3]).toMatch(/crashed/);
});
