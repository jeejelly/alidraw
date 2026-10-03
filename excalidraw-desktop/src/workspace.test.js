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

const scene = (count = 0) =>
  JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements: Array(count).fill({}),
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
    const workspace = await ws.create({
      name: "Checkout flow",
      parent: path.join(tmp, "projects"),
    });
    expect(workspace.name).toBe("Checkout flow");
    expect(fs.existsSync(path.join(workspace.path, ".git"))).toBe(true);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(workspace.path, "workspace.json"), "utf8"),
      ).name,
    ).toBe("Checkout flow");
    // the first commit is made, with a neutral identity
    const history = await git.log(workspace.path);
    expect(history.map((entry) => entry.subject)).toEqual(["Create workspace"]);
    expect(ws.list().map((x) => x.name)).toEqual(["Checkout flow"]);
    expect(ws.list()[0].settings).toMatchObject({
      autoCommit: true,
      delaySec: 60,
    });
  });

  it("can skip git, and refuses a used folder", async () => {
    const projectsDir = path.join(tmp, "projects");
    const workspace = await ws.create({
      name: "Plain",
      parent: projectsDir,
      useGit: false,
    });
    expect(fs.existsSync(path.join(workspace.path, ".git"))).toBe(false);
    await expect(
      ws.create({ name: "Plain", parent: projectsDir, useGit: false }),
    ).rejects.toThrow(/not empty/);
    await expect(ws.create({ name: " ", parent: projectsDir })).rejects.toThrow(
      /name/,
    );
  });

  it("opens an existing folder", async () => {
    const dir = path.join(tmp, "projects", "old");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "a.excalidraw"), scene());
    const workspace = await ws.open(dir);
    expect(workspace.name).toBe("old");
    expect(ws.scenes(workspace.id).map((item) => item.path)).toEqual([
      "a.excalidraw",
    ]);
    // opening again does not duplicate it
    await ws.open(dir);
    expect(ws.list()).toHaveLength(1);
  });

  it("a folder becomes a workspace under git, keeping what is in it", async () => {
    const dir = path.join(tmp, "projects", "fresh");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "a.excalidraw"), scene());
    const workspace = await ws.open(dir);
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);
    expect((await git.status(dir)).clean).toBe(true);
    expect((await git.log(dir)).map((commit) => commit.subject)).toEqual([
      "Create workspace",
    ]);
    const again = await ws.open(dir);
    expect(again.id).toBe(workspace.id);
    const plain = path.join(tmp, "projects", "plain");
    fs.mkdirSync(plain);
    await ws.open(plain, { useGit: false });
    expect(fs.existsSync(path.join(plain, ".git"))).toBe(false);
  });

  it("saves a new scene straight into the workspace, uniquely named", async () => {
    const workspace = await ws.create({
      name: "S",
      parent: path.join(tmp, "projects"),
    });
    const firstPath = ws.saveNewScene(workspace.id, "Untitled", scene(1));
    const secondPath = ws.saveNewScene(workspace.id, "Untitled", scene(2));
    expect([firstPath, secondPath]).toEqual([
      "Untitled.excalidraw",
      "Untitled-2.excalidraw",
    ]);
    expect(
      JSON.parse(ws.readScene(workspace.id, secondPath)).elements,
    ).toHaveLength(2);
    expect(() => ws.saveNewScene(workspace.id, "x", "not json")).toThrow();
  });

  it("lists, creates, reads and writes scenes inside it", async () => {
    const workspace = await ws.create({
      name: "W",
      parent: path.join(tmp, "projects"),
    });
    const firstPath = ws.newScene(workspace.id, "Home screen");
    const secondPath = ws.newScene(workspace.id, "Home screen");
    expect([firstPath, secondPath]).toEqual([
      "Home-screen.excalidraw",
      "Home-screen-2.excalidraw",
    ]);
    const nested = ws.newScene(workspace.id, "x", "flows/checkout");
    expect(nested).toBe("flows/checkout/x.excalidraw");
    expect(
      ws
        .scenes(workspace.id)
        .map((item) => item.path)
        .sort(),
    ).toEqual([firstPath, secondPath, nested].sort());
    expect(
      ws.writeScene(workspace.id, firstPath, scene(3)).bytes,
    ).toBeGreaterThan(10);
    expect(
      JSON.parse(ws.readScene(workspace.id, firstPath)).elements,
    ).toHaveLength(3);
  });

  it("refuses paths outside, other file types and broken JSON", async () => {
    const workspace = await ws.create({
      name: "W",
      parent: path.join(tmp, "projects"),
    });
    expect(() =>
      ws.writeScene(workspace.id, "../out.excalidraw", scene()),
    ).toThrow();
    expect(() => ws.writeScene(workspace.id, "notes.txt", scene())).toThrow(
      /scene/,
    );
    const scenePath = ws.newScene(workspace.id, "a");
    expect(() =>
      ws.writeScene(workspace.id, scenePath, "{ not json"),
    ).toThrow();
    expect(JSON.parse(ws.readScene(workspace.id, scenePath)).type).toBe(
      "excalidraw",
    );
    expect(() => ws.readScene(workspace.id, ".git/config")).toThrow();
  });

  it("reports a missing folder", async () => {
    const workspace = await ws.create({
      name: "W",
      parent: path.join(tmp, "projects"),
      useGit: false,
    });
    fs.rmSync(workspace.path, { recursive: true });
    expect(ws.list()[0].exists).toBe(false);
    expect(() => ws.scenes(workspace.id)).toThrow(/missing/);
  });
});

describe("exports", () => {
  it("land in exports/ under their name, replace an earlier export, and cannot escape", async () => {
    const workspace = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    const b64 = (text) => Buffer.from(text).toString("base64");
    const one = ws.writeExport(workspace.id, "Poster.png", b64("v1"));
    expect(one.path).toBe("exports/Poster.png");
    ws.writeExport(workspace.id, "Poster.png", b64("v2"));
    expect(fs.readFileSync(path.join(workspace.path, one.path), "utf8")).toBe(
      "v2",
    );
    // separators and leading dots are flattened: it stays in exports/
    const odd = ws.writeExport(workspace.id, "../../evil.svg", b64("x"));
    expect(odd.path.startsWith("exports/")).toBe(true);
    expect(odd.path.slice("exports/".length)).not.toMatch(/[\\/]/);
    expect(fs.existsSync(path.join(tmp, "evil.svg"))).toBe(false);
    expect(() => ws.writeExport(workspace.id, "", b64("x"))).toThrow();
  });
});

describe("assets", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString(
    "base64",
  );

  it("are stored once by content, with an extension from their type", async () => {
    const workspace = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    const firstPath = ws.writeAsset(workspace.id, "image/png", png);
    const secondPath = ws.writeAsset(workspace.id, "image/png", png);
    expect(firstPath.path).toMatch(/^assets\/[0-9a-f]{64}\.png$/);
    expect(secondPath).toEqual(firstPath);
    expect(fs.readdirSync(path.join(workspace.path, "assets"))).toHaveLength(1);
    expect(ws.readAsset(workspace.id, firstPath.path)).toBe(png);
    const other = ws.writeAsset(
      workspace.id,
      "image/jpeg",
      Buffer.from("jpegbytes").toString("base64"),
    );
    expect(other.path).toMatch(/\.jpg$/);
    expect(
      ws.writeAsset(
        workspace.id,
        "application/x-weird",
        Buffer.from("zz").toString("base64"),
      ).path,
    ).toMatch(/\.bin$/);
  });

  it("only files under assets/ can be read, and nothing empty is written", async () => {
    const workspace = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    fs.writeFileSync(path.join(workspace.path, "secret.txt"), "x");
    for (const bad of [
      "../x",
      "secret.txt",
      "assets/../secret.txt",
      "assets/short.png",
      ".git/config",
    ]) {
      expect(() => ws.readAsset(workspace.id, bad)).toThrow();
    }
    expect(() => ws.writeAsset(workspace.id, "image/png", "")).toThrow(/empty/);
    expect(() => ws.writeAsset(workspace.id, 5, png)).toThrow();
  });

  it("are committed with the scene's workspace like any file", async () => {
    const workspace = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    const assetPath = ws.writeAsset(workspace.id, "image/png", png);
    await git.commit(workspace.path, "add image", [assetPath.path]);
    expect((await git.status(workspace.path)).clean).toBe(true);
    expect(
      (await git.log(workspace.path)).map((commit) => commit.subject),
    ).toContain("add image");
  });

  it("the shared setting for new images lives in workspace.json", async () => {
    const workspace = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    expect(ws.meta(workspace.id).assets).toBe("embedded");
    ws.setMeta(workspace.id, { assets: "linked" });
    expect(
      JSON.parse(
        fs.readFileSync(path.join(workspace.path, "workspace.json"), "utf8"),
      ).assets,
    ).toBe("linked");
    expect(ws.meta(workspace.id).name).toBe("A");
  });
});

describe("git", () => {
  it("commits only what changed, and reads history and old versions", async () => {
    const workspace = await ws.create({
      name: "G",
      parent: path.join(tmp, "projects"),
    });
    const scenePath = ws.newScene(workspace.id, "a");
    expect(await git.commit(workspace.path, "first", [scenePath])).toMatch(
      /^[0-9a-f]+$/,
    );
    // same content: nothing to commit
    expect(await git.commit(workspace.path, "again", [scenePath])).toBeNull();
    ws.writeScene(workspace.id, scenePath, scene(2));
    const st = await git.status(workspace.path);
    expect(st.clean).toBe(false);
    expect(st.changes.map((change) => change.path)).toEqual([scenePath]);
    expect(st.branch).toBe("main");
    await git.commit(workspace.path, "second", [scenePath]);
    const log = await git.log(workspace.path, scenePath);
    expect(log.map((commit) => commit.subject)).toEqual(["second", "first"]);
    // the version before
    const before = JSON.parse(
      await git.showFile(workspace.path, log[1].hash, scenePath),
    );
    expect(before.elements).toHaveLength(0);
    expect(() => git.showFile(workspace.path, "--output=x", scenePath)).toThrow(
      /invalid/,
    );
    expect((await git.status(workspace.path)).clean).toBe(true);
  });

  it("does not commit files it was not told about", async () => {
    const workspace = await ws.create({
      name: "G",
      parent: path.join(tmp, "projects"),
    });
    const scenePath = ws.newScene(workspace.id, "a");
    fs.writeFileSync(path.join(workspace.path, "other.txt"), "x");
    await git.commit(workspace.path, "only a", [scenePath]);
    const st = await git.status(workspace.path);
    expect(st.changes.map((change) => change.path)).toEqual(["other.txt"]);
  });

  it("refuses transports that run commands", async () => {
    const workspace = await ws.create({
      name: "G",
      parent: path.join(tmp, "projects"),
    });
    await expect(
      git.run(workspace.path, ["ls-remote", "ext::sh -c 'touch /tmp/pwned'"]),
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
      onResult: (id, result) => results.push(result),
      setTimer: (fn, ms) => {
        const timer = { fn, ms, cleared: false };
        timers.push(timer);
        return timer;
      },
      clearTimer: (timer) => {
        timer.cleared = true;
      },
    });
    return { auto, timers, results };
  };

  it("waits for edits to pause, then commits the written files", async () => {
    const workspace = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    const scenePath = ws.newScene(workspace.id, "a");
    const { auto, timers, results } = harness();
    auto.touch(workspace.id, workspace.path, scenePath);
    auto.touch(workspace.id, workspace.path, scenePath);
    // each write restarts the wait
    expect(timers.map((timer) => timer.cleared)).toEqual([true, false]);
    expect(timers[1].ms).toBe(5000);
    await auto.flush(workspace.id);
    expect(results).toEqual([{ ok: true, hash: expect.any(String) }]);
    const log = await git.log(workspace.path);
    expect(log[0].subject).toBe("Update a.excalidraw");
    expect(auto.hasPending(workspace.id)).toBe(false);
  });

  it("does nothing when auto commit is off, or content is unchanged", async () => {
    const workspace = await ws.create({
      name: "A",
      parent: path.join(tmp, "projects"),
    });
    const scenePath = ws.newScene(workspace.id, "a");
    const off = new AutoCommit({ delayFor: () => null, onResult: () => {} });
    off.touch(workspace.id, workspace.path, scenePath);
    expect(off.hasPending(workspace.id)).toBe(false);
    const { auto, results } = harness();
    await git.commit(workspace.path, "x", [scenePath]);
    auto.touch(workspace.id, workspace.path, scenePath);
    await auto.flush(workspace.id);
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
    const workspace = await ws.create({
      name: "K",
      parent: path.join(tmp, "projects"),
      useGit: false,
    });
    expect(ws.registry.appSettings()).toEqual({ paused: true });
    ws.forget(workspace.id);
    expect(ws.registry.appSettings()).toEqual({ paused: true });
    ws.registry.setAppSettings({ paused: false });
    expect(ws.registry.appSettings()).toEqual({ paused: false });
  });
});

describe("scene management", () => {
  it("renames, duplicates and deletes scenes without overwriting", async () => {
    const parent = path.join(tmp, "projects");
    const workspace = await ws.create({ name: "Shop", parent, useGit: false });
    const firstPath = ws.newScene(workspace.id, "Alpha");
    const secondPath = ws.newScene(workspace.id, "Beta");
    expect(ws.renameScene(workspace.id, firstPath, "Gamma delta")).toBe(
      "Gamma-delta.excalidraw",
    );
    expect(() =>
      ws.renameScene(workspace.id, "Gamma-delta.excalidraw", "Beta"),
    ).toThrow(/already exists/);
    expect(() => ws.renameScene(workspace.id, secondPath, "  ")).toThrow(
      /name/,
    );
    expect(() =>
      ws.renameScene(workspace.id, "../x.excalidraw", "x"),
    ).toThrow();
    const copy = ws.duplicateScene(workspace.id, secondPath);
    expect(copy).toBe("Beta-copy.excalidraw");
    expect(ws.duplicateScene(workspace.id, secondPath)).toBe(
      "Beta-copy-2.excalidraw",
    );
    ws.deleteScene(workspace.id, copy);
    expect(
      ws
        .scenes(workspace.id)
        .map((item) => item.path)
        .sort(),
    ).toEqual([
      "Beta-copy-2.excalidraw",
      "Beta.excalidraw",
      "Gamma-delta.excalidraw",
    ]);
    expect(() => ws.deleteScene(workspace.id, "assets/x.png")).toThrow();
  });

  it("lists the pictures kept in assets", async () => {
    const workspace = await ws.create({
      name: "Pics",
      parent: path.join(tmp, "projects"),
      useGit: false,
    });
    expect(ws.listAssets(workspace.id)).toEqual([]);
    const { path: assetPath } = ws.writeAsset(
      workspace.id,
      "image/png",
      Buffer.from("png-bytes").toString("base64"),
    );
    expect(ws.listAssets(workspace.id).map((asset) => asset.path)).toEqual([
      assetPath,
    ]);
  });
});

describe("a workspace inside a bigger repository", () => {
  it("shows, commits and restores only its own folder", async () => {
    const repo = path.join(tmp, "big");
    fs.mkdirSync(path.join(repo, "designs"), { recursive: true });
    await git.init(repo);
    fs.writeFileSync(path.join(repo, "other.txt"), "x");
    fs.writeFileSync(path.join(repo, "designs", "a.excalidraw"), scene(1));
    await git.commit(repo, "start");
    // changes in both places
    fs.writeFileSync(path.join(repo, "other.txt"), "changed");
    fs.writeFileSync(path.join(repo, "unrelated.md"), "new");
    fs.writeFileSync(path.join(repo, "designs", "a.excalidraw"), scene(2));
    fs.writeFileSync(path.join(repo, "designs", "b.excalidraw"), scene(0));
    const folder = path.join(repo, "designs");

    const st = await git.status(folder);
    expect(st.changes.map((change) => change.path).sort()).toEqual([
      "a.excalidraw",
      "b.excalidraw",
    ]);

    const hash = await git.commit(folder, "designs only");
    expect(hash).toBeTruthy();
    // the rest of the repository is untouched
    const rest = await git.status(repo);
    expect(rest.changes.map((change) => change.path).sort()).toEqual([
      "other.txt",
      "unrelated.md",
    ]);

    const log = await git.log(folder, "a.excalidraw");
    expect(log[0].subject).toBe("designs only");
    expect(await git.showFile(folder, log[1].hash, "a.excalidraw")).toBe(
      scene(1),
    );
    expect(await git.prefixOf(folder)).toBe("designs/");
  });
});
