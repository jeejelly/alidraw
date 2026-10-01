import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

const git = require("./git");
const { AutoCommit, message } = require("./autocommit");
const { resolveInside, slug } = require("./paths");
const { Registry } = require("./registry");
const { Workspaces } = require("./workspace");

let tmp;
let ws;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wsp-"));
  fs.mkdirSync(path.join(tmp, "data"));
  fs.mkdirSync(path.join(tmp, "projects"));
  ws = new Workspaces({ registry: new Registry(path.join(tmp, "data")) });
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

const scene = (n = 0) =>
  JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements: Array(n).fill({}),
    appState: {},
    files: {},
  });

describe("paths", () => {
  it("stays inside the folder", () => {
    const root = path.join(tmp, "projects");
    expect(resolveInside(root, "a/b.excalidraw")).toBe(
      path.join(root, "a", "b.excalidraw"),
    );
    for (const bad of [
      "../x",
      "a/../../x",
      "/etc/passwd",
      "C:\\x",
      ".git/config",
      "",
      "a\0b",
    ]) {
      expect(() => resolveInside(root, bad)).toThrow();
    }
  });
  it("makes safe folder names", () => {
    expect(slug("My Été project!")).toBe("My-Ete-project");
    expect(slug("..")).toBe("workspace");
  });
});

describe("workspaces", () => {
  it("creates a named, git-backed workspace and remembers it", async () => {
    const w = await ws.create({
      name: "Checkout flow",
      parent: path.join(tmp, "projects"),
    });
    expect(w.name).toBe("Checkout flow");
    expect(fs.existsSync(path.join(w.path, ".git"))).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(path.join(w.path, "workspace.json"), "utf8"))
        .name,
    ).toBe("Checkout flow");
    // the first commit is made, with a neutral identity
    const history = await git.log(w.path);
    expect(history.map((h) => h.subject)).toEqual(["Create workspace"]);
    expect(ws.list().map((x) => x.name)).toEqual(["Checkout flow"]);
    expect(ws.list()[0].settings).toMatchObject({
      autoCommit: true,
      delaySec: 60,
    });
  });

  it("can skip git, and refuses a used folder", async () => {
    const p = path.join(tmp, "projects");
    const w = await ws.create({ name: "Plain", parent: p, useGit: false });
    expect(fs.existsSync(path.join(w.path, ".git"))).toBe(false);
    await expect(
      ws.create({ name: "Plain", parent: p, useGit: false }),
    ).rejects.toThrow(/not empty/);
    await expect(ws.create({ name: " ", parent: p })).rejects.toThrow(/name/);
  });

  it("opens an existing folder", async () => {
    const dir = path.join(tmp, "projects", "old");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "a.excalidraw"), scene());
    const w = await ws.open(dir);
    expect(w.name).toBe("old");
    expect(ws.scenes(w.id).map((s) => s.path)).toEqual(["a.excalidraw"]);
    // opening again does not duplicate it
    await ws.open(dir);
    expect(ws.list()).toHaveLength(1);
  });

  it("a folder becomes a workspace under git, keeping what is in it", async () => {
    const dir = path.join(tmp, "projects", "fresh");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "a.excalidraw"), scene());
    const w = await ws.open(dir);
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);
    expect((await git.status(dir)).clean).toBe(true);
    expect((await git.log(dir)).map((l) => l.subject)).toEqual([
      "Create workspace",
    ]);
    const again = await ws.open(dir);
    expect(again.id).toBe(w.id);
    const plain = path.join(tmp, "projects", "plain");
    fs.mkdirSync(plain);
    await ws.open(plain, { useGit: false });
    expect(fs.existsSync(path.join(plain, ".git"))).toBe(false);
  });

  it("saves a new scene straight into the workspace, uniquely named", async () => {
    const w = await ws.create({
      name: "S",
      parent: path.join(tmp, "projects"),
    });
    const a = ws.saveNewScene(w.id, "Untitled", scene(1));
    const b = ws.saveNewScene(w.id, "Untitled", scene(2));
    expect([a, b]).toEqual(["Untitled.excalidraw", "Untitled-2.excalidraw"]);
    expect(JSON.parse(ws.readScene(w.id, b)).elements).toHaveLength(2);
    expect(() => ws.saveNewScene(w.id, "x", "not json")).toThrow();
  });

  it("lists, creates, reads and writes scenes inside it", async () => {
    const w = await ws.create({
      name: "W",
      parent: path.join(tmp, "projects"),
    });
    const a = ws.newScene(w.id, "Home screen");
    const b = ws.newScene(w.id, "Home screen");
    expect([a, b]).toEqual([
      "Home-screen.excalidraw",
      "Home-screen-2.excalidraw",
    ]);
    const nested = ws.newScene(w.id, "x", "flows/checkout");
    expect(nested).toBe("flows/checkout/x.excalidraw");
    expect(
      ws
        .scenes(w.id)
        .map((s) => s.path)
        .sort(),
    ).toEqual([a, b, nested].sort());
    expect(ws.writeScene(w.id, a, scene(3)).bytes).toBeGreaterThan(10);
    expect(JSON.parse(ws.readScene(w.id, a)).elements).toHaveLength(3);
  });

  it("refuses paths outside, other file types and broken JSON", async () => {
    const w = await ws.create({
      name: "W",
      parent: path.join(tmp, "projects"),
    });
    expect(() => ws.writeScene(w.id, "../out.excalidraw", scene())).toThrow();
    expect(() => ws.writeScene(w.id, "notes.txt", scene())).toThrow(/scene/);
    const a = ws.newScene(w.id, "a");
    expect(() => ws.writeScene(w.id, a, "{ not json")).toThrow();
    expect(JSON.parse(ws.readScene(w.id, a)).type).toBe("excalidraw");
    expect(() => ws.readScene(w.id, ".git/config")).toThrow();
  });

  it("reports a missing folder", async () => {
    const w = await ws.create({
      name: "W",
      parent: path.join(tmp, "projects"),
      useGit: false,
    });
    fs.rmSync(w.path, { recursive: true });
    expect(ws.list()[0].exists).toBe(false);
    expect(() => ws.scenes(w.id)).toThrow(/missing/);
  });
});

describe("assets", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString(
    "base64",
  );

  it("are stored once by content, with an extension from their type", async () => {
    const w = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    const a = ws.writeAsset(w.id, "image/png", png);
    const b = ws.writeAsset(w.id, "image/png", png);
    expect(a.path).toMatch(/^assets\/[0-9a-f]{64}\.png$/);
    expect(b).toEqual(a);
    expect(fs.readdirSync(path.join(w.path, "assets"))).toHaveLength(1);
    expect(ws.readAsset(w.id, a.path)).toBe(png);
    const other = ws.writeAsset(
      w.id,
      "image/jpeg",
      Buffer.from("jpegbytes").toString("base64"),
    );
    expect(other.path).toMatch(/\.jpg$/);
    expect(
      ws.writeAsset(
        w.id,
        "application/x-weird",
        Buffer.from("zz").toString("base64"),
      ).path,
    ).toMatch(/\.bin$/);
  });

  it("only files under assets/ can be read, and nothing empty is written", async () => {
    const w = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    fs.writeFileSync(path.join(w.path, "secret.txt"), "x");
    for (const bad of [
      "../x",
      "secret.txt",
      "assets/../secret.txt",
      "assets/short.png",
      ".git/config",
    ]) {
      expect(() => ws.readAsset(w.id, bad)).toThrow();
    }
    expect(() => ws.writeAsset(w.id, "image/png", "")).toThrow(/empty/);
    expect(() => ws.writeAsset(w.id, 5, png)).toThrow();
  });

  it("are committed with the scene's workspace like any file", async () => {
    const w = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    const a = ws.writeAsset(w.id, "image/png", png);
    await git.commit(w.path, "add image", [a.path]);
    expect((await git.status(w.path)).clean).toBe(true);
    expect((await git.log(w.path)).map((l) => l.subject)).toContain(
      "add image",
    );
  });

  it("the shared setting for new images lives in workspace.json", async () => {
    const w = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    expect(ws.meta(w.id).assets).toBe("embedded");
    ws.setMeta(w.id, { assets: "linked" });
    expect(
      JSON.parse(fs.readFileSync(path.join(w.path, "workspace.json"), "utf8"))
        .assets,
    ).toBe("linked");
    expect(ws.meta(w.id).name).toBe("A");
  });
});

describe("git", () => {
  it("commits only what changed, and reads history and old versions", async () => {
    const w = await ws.create({
      name: "G",
      parent: path.join(tmp, "projects"),
    });
    const a = ws.newScene(w.id, "a");
    expect(await git.commit(w.path, "first", [a])).toMatch(/^[0-9a-f]+$/);
    // same content: nothing to commit
    expect(await git.commit(w.path, "again", [a])).toBeNull();
    ws.writeScene(w.id, a, scene(2));
    const st = await git.status(w.path);
    expect(st.clean).toBe(false);
    expect(st.changes.map((c) => c.path)).toEqual([a]);
    expect(st.branch).toBe("main");
    await git.commit(w.path, "second", [a]);
    const log = await git.log(w.path, a);
    expect(log.map((l) => l.subject)).toEqual(["second", "first"]);
    // the version before
    const before = JSON.parse(await git.showFile(w.path, log[1].hash, a));
    expect(before.elements).toHaveLength(0);
    expect(() => git.showFile(w.path, "--output=x", a)).toThrow(/invalid/);
    expect((await git.status(w.path)).clean).toBe(true);
  });

  it("does not commit files it was not told about", async () => {
    const w = await ws.create({
      name: "G",
      parent: path.join(tmp, "projects"),
    });
    const a = ws.newScene(w.id, "a");
    fs.writeFileSync(path.join(w.path, "other.txt"), "x");
    await git.commit(w.path, "only a", [a]);
    const st = await git.status(w.path);
    expect(st.changes.map((c) => c.path)).toEqual(["other.txt"]);
  });

  it("refuses transports that run commands", async () => {
    const w = await ws.create({
      name: "G",
      parent: path.join(tmp, "projects"),
    });
    await expect(
      git.run(w.path, ["ls-remote", "ext::sh -c 'touch /tmp/pwned'"]),
    ).rejects.toThrow();
    expect(fs.existsSync("/tmp/pwned")).toBe(false);
  });
});

describe("auto commit", () => {
  const harness = (delay = 5000) => {
    const timers = [];
    const results = [];
    const auto = new AutoCommit({
      delayFor: () => delay,
      onResult: (id, r) => results.push(r),
      setTimer: (fn, ms) => {
        const t = { fn, ms, cleared: false };
        timers.push(t);
        return t;
      },
      clearTimer: (t) => {
        t.cleared = true;
      },
    });
    return { auto, timers, results };
  };

  it("waits for edits to pause, then commits the written files", async () => {
    const w = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    const a = ws.newScene(w.id, "a");
    const { auto, timers, results } = harness();
    auto.touch(w.id, w.path, a);
    auto.touch(w.id, w.path, a);
    // each write restarts the wait
    expect(timers.map((t) => t.cleared)).toEqual([true, false]);
    expect(timers[1].ms).toBe(5000);
    await auto.flush(w.id);
    expect(results).toEqual([{ ok: true, hash: expect.any(String) }]);
    const log = await git.log(w.path);
    expect(log[0].subject).toBe("Update a.excalidraw");
    expect(auto.hasPending(w.id)).toBe(false);
  });

  it("does nothing when auto commit is off, or content is unchanged", async () => {
    const w = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    const a = ws.newScene(w.id, "a");
    const off = new AutoCommit({ delayFor: () => null, onResult: () => {} });
    off.touch(w.id, w.path, a);
    expect(off.hasPending(w.id)).toBe(false);
    const { auto, results } = harness();
    await git.commit(w.path, "x", [a]);
    auto.touch(w.id, w.path, a);
    await auto.flush(w.id);
    expect(results).toEqual([{ ok: true, hash: null }]);
  });

  it("words the message by how many files", () => {
    expect(message(["a/b.excalidraw"])).toBe("Update b.excalidraw");
    expect(message(["a", "b", "c"])).toBe("Update a, b, c");
    expect(message(["a", "b", "c", "d"])).toBe("Update 4 files");
  });
});

describe("app settings", () => {
  it("are kept apart from the workspaces and survive changes to them", async () => {
    expect(ws.registry.appSettings()).toEqual({});
    ws.registry.setAppSettings({ paused: true });
    const w = await ws.create({
      name: "K",
      parent: path.join(tmp, "projects"),
      useGit: false,
    });
    expect(ws.registry.appSettings()).toEqual({ paused: true });
    ws.forget(w.id);
    expect(ws.registry.appSettings()).toEqual({ paused: true });
    ws.registry.setAppSettings({ paused: false });
    expect(ws.registry.appSettings()).toEqual({ paused: false });
  });
});
