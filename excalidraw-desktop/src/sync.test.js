import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

const git = require("./git");
const { Registry } = require("./registry");
const { Sync, explain } = require("./sync");
const { Workspaces } = require("./workspace");

let tmp;
let remote;
let events;

const scene = (n) =>
  JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements: Array(n).fill({}),
    appState: {},
    files: {},
  });

const machine = async (name, { paused = () => false } = {}) => {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  const workspaces = new Workspaces({
    registry: new Registry(path.join(dir, "data")),
  });
  const sync = new Sync({
    workspaces,
    isPaused: paused,
    flush: async () => {},
    emit: (e) => events.push({ machine: name, ...e }),
    now: () => new Date(2026, 9, 5, 14, 30),
  });
  return { workspaces, sync, dir };
};

const commitFile = async (w, id, rel, n, msg) => {
  w.writeScene(id, rel, scene(n));
  await git.commit(w.root(id), msg, [rel]);
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sync-"));
  remote = path.join(tmp, "remote.git");
  execFileSync("git", ["init", "--bare", "-b", "main", remote]);
  events = [];
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** machine A creates the project and pushes; machine B clones it */
const twoMachines = async () => {
  const A = await machine("A");
  const wa = await A.workspaces.create({ name: "Proj", parent: A.dir });
  const a = A.workspaces.newScene(wa.id, "main");
  await git.commit(wa.path, "add main", [a]);
  await A.sync.setRemote(wa.id, remote);
  expect((await A.sync.sync(wa.id)).outcome).toBe("pushed");

  const B = await machine("B");
  const clone = path.join(B.dir, "Proj");
  execFileSync("git", ["clone", remote, clone]);
  const wb = await B.workspaces.open(clone);
  return { A, B, wa, wb, scenePath: a };
};

describe("remote address", () => {
  it("accepts real addresses and refuses ones that run commands", () => {
    for (const ok of [
      "https://host/p.git",
      "ssh://git@host/p.git",
      "git@host:p.git",
      "/srv/p.git",
      "file:///srv/p.git",
    ]) {
      expect(git.checkRemoteUrl(ok)).toBe(ok);
    }
    for (const bad of [
      "ext::sh -c id",
      "-oProxyCommand=x",
      "",
      "http://host/p",
      "a b",
      "fd::1",
    ]) {
      expect(() => git.checkRemoteUrl(bad)).toThrow();
    }
  });
});

describe("sync", () => {
  it("pushes the first time, and a second machine pulls what the first wrote", async () => {
    const { A, B, wa, wb, scenePath } = await twoMachines();
    expect(B.workspaces.scenes(wb.id).map((s) => s.path)).toEqual([scenePath]);

    await commitFile(A.workspaces, wa.id, scenePath, 3, "A edits");
    expect((await A.sync.sync(wa.id)).outcome).toBe("pushed");

    const r = await B.sync.sync(wb.id);
    expect(r).toEqual({ outcome: "pulled", files: [scenePath] });
    expect(
      JSON.parse(B.workspaces.readScene(wb.id, scenePath)).elements,
    ).toHaveLength(3);
    expect(
      events.find((e) => e.machine === "B" && e.type === "pulled").files,
    ).toEqual([scenePath]);
    expect((await B.sync.sync(wb.id)).outcome).toBe("in-sync");
  });

  it("without a remote there is nothing to do; paused does nothing at all", async () => {
    const A = await machine("A", { paused: () => true });
    const w = await A.workspaces.create({ name: "P", parent: A.dir });
    expect((await A.sync.sync(w.id)).outcome).toBe("paused");
    const B = await machine("B");
    const w2 = await B.workspaces.create({ name: "P", parent: B.dir });
    expect((await B.sync.sync(w2.id)).outcome).toBe("no-remote");
    await expect(A.sync.resolve(w.id, "merge")).rejects.toThrow(/paused/);
  });

  it("an unreachable remote is an error with words, not a crash", async () => {
    const A = await machine("A");
    const w = await A.workspaces.create({ name: "P", parent: A.dir });
    await A.sync.setRemote(w.id, path.join(tmp, "nowhere.git"));
    const r = await A.sync.sync(w.id);
    expect(r.outcome).toBe("blocked");
    expect(A.sync.info(w.id).state).toBe("error");
  });

  it("when both sides moved: stops, pushes nothing, and merging different files works", async () => {
    const { A, B, wa, wb, scenePath } = await twoMachines();
    const other = A.workspaces.newScene(wa.id, "other");
    await git.commit(wa.path, "A adds other", [other]);
    await A.sync.sync(wa.id);

    const mine = B.workspaces.newScene(wb.id, "mine");
    await git.commit(wb.path, "B adds mine", [mine]);
    const r = await B.sync.sync(wb.id);
    expect(r.outcome).toBe("diverged");
    expect(B.sync.info(wb.id).state).toBe("diverged");
    // the remote did not get B's commit
    const onRemote = execFileSync("git", ["log", "--format=%s", "main"], {
      cwd: remote,
    }).toString();
    expect(onRemote).not.toContain("B adds mine");

    const m = await B.sync.resolve(wb.id, "merge");
    expect(m.outcome).toBe("merged");
    expect(
      B.workspaces
        .scenes(wb.id)
        .map((s) => s.path)
        .sort(),
    ).toEqual([mine, other, scenePath].sort());
    expect((await B.sync.sync(wb.id)).outcome).toBe("pushed");
    expect((await A.sync.sync(wa.id)).outcome).toBe("pulled");
    expect(
      A.workspaces
        .scenes(wa.id)
        .map((s) => s.path)
        .sort(),
    ).toEqual([mine, other, scenePath].sort());
  });

  it("a clash in one file: the merge is undone, and a branch of its own keeps both", async () => {
    const { A, B, wa, wb, scenePath } = await twoMachines();
    await commitFile(A.workspaces, wa.id, scenePath, 2, "A edits");
    await A.sync.sync(wa.id);
    await commitFile(B.workspaces, wb.id, scenePath, 5, "B edits");
    expect((await B.sync.sync(wb.id)).outcome).toBe("diverged");
    const headBefore = await git.head(wb.path);

    const m = await B.sync.resolve(wb.id, "merge");
    expect(m.outcome).toBe("conflict");
    expect(m.conflicts).toEqual([scenePath]);
    // nothing changed: same commit, clean tree, B's version intact
    expect(await git.head(wb.path)).toBe(headBefore);
    expect((await git.status(wb.path)).clean).toBe(true);
    expect(
      JSON.parse(B.workspaces.readScene(wb.id, scenePath)).elements,
    ).toHaveLength(5);
    expect(B.sync.info(wb.id).message).toMatch(/new branch/);

    const b = await B.sync.resolve(wb.id, "branch");
    expect(b.outcome).toBe("branched");
    expect(b.branch).toMatch(/^ws\/.+-20261005-1430$/);
    expect((await git.status(wb.path)).branch).toBe(b.branch);
    const branches = execFileSync("git", ["branch", "--list"], {
      cwd: remote,
    }).toString();
    expect(branches).toContain(b.branch);
    // main on the remote is still A's
    const mainLog = execFileSync("git", ["log", "--format=%s", "main"], {
      cwd: remote,
    }).toString();
    expect(mainLog).toContain("A edits");
    expect(mainLog).not.toContain("B edits");
    // the new branch syncs by itself from now on
    expect((await B.sync.sync(wb.id)).outcome).toBe("in-sync");
  });
});

describe("explaining failures", () => {
  it("tells what to do about a login problem", () => {
    expect(
      explain(
        new Error(
          "fatal: could not read Username for 'https://x': terminal prompts disabled",
        ),
      ),
    ).toMatch(/credential helper or an ssh key/);
    expect(
      explain(new Error("fatal: Could not resolve host: example.org")),
    ).toMatch(/cannot be reached/);
    expect(explain(new Error("boom"))).toBe("boom");
  });
});
