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

const scene = (count) =>
  JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements: Array(count).fill({}),
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
    emit: (payload) => events.push({ machine: name, ...payload }),
    now: () => new Date(2026, 9, 5, 14, 30),
  });
  return { workspaces, sync, dir };
};

const commitFile = async (workspaces, id, rel, count, msg) => {
  workspaces.writeScene(id, rel, scene(count));
  await git.commit(workspaces.root(id), msg, [rel]);
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
  const machineA = await machine("A");
  const wa = await machineA.workspaces.create({
    name: "Proj",
    parent: machineA.dir,
  });
  const createdPath = machineA.workspaces.newScene(wa.id, "main");
  await git.commit(wa.path, "add main", [createdPath]);
  await machineA.sync.setRemote(wa.id, remote);
  expect((await machineA.sync.sync(wa.id)).outcome).toBe("pushed");

  const machineB = await machine("B");
  const clone = path.join(machineB.dir, "Proj");
  execFileSync("git", ["clone", remote, clone]);
  const wb = await machineB.workspaces.open(clone);
  return { A: machineA, B: machineB, wa, wb, scenePath: createdPath };
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
    const { A: machineA, B: machineB, wa, wb, scenePath } = await twoMachines();
    expect(machineB.workspaces.scenes(wb.id).map((item) => item.path)).toEqual([
      scenePath,
    ]);

    await commitFile(machineA.workspaces, wa.id, scenePath, 3, "A edits");
    expect((await machineA.sync.sync(wa.id)).outcome).toBe("pushed");

    const result = await machineB.sync.sync(wb.id);
    expect(result).toEqual({ outcome: "pulled", files: [scenePath] });
    expect(
      JSON.parse(machineB.workspaces.readScene(wb.id, scenePath)).elements,
    ).toHaveLength(3);
    expect(
      events.find((entry) => entry.machine === "B" && entry.type === "pulled")
        .files,
    ).toEqual([scenePath]);
    expect((await machineB.sync.sync(wb.id)).outcome).toBe("in-sync");
  });

  it("without a remote there is nothing to do; paused does nothing at all", async () => {
    const machineA = await machine("A", { paused: () => true });
    const workspace = await machineA.workspaces.create({
      name: "P",
      parent: machineA.dir,
    });
    expect((await machineA.sync.sync(workspace.id)).outcome).toBe("paused");
    const machineB = await machine("B");
    const w2 = await machineB.workspaces.create({
      name: "P",
      parent: machineB.dir,
    });
    expect((await machineB.sync.sync(w2.id)).outcome).toBe("no-remote");
    await expect(machineA.sync.resolve(workspace.id, "merge")).rejects.toThrow(
      /paused/,
    );
  });

  it("an unreachable remote is an error with words, not a crash", async () => {
    const machineA = await machine("A");
    const workspace = await machineA.workspaces.create({
      name: "P",
      parent: machineA.dir,
    });
    await machineA.sync.setRemote(workspace.id, path.join(tmp, "nowhere.git"));
    const result = await machineA.sync.sync(workspace.id);
    expect(result.outcome).toBe("blocked");
    expect(machineA.sync.info(workspace.id).state).toBe("error");
  });

  it("when both sides moved: stops, pushes nothing, and merging different files works", async () => {
    const { A: machineA, B: machineB, wa, wb, scenePath } = await twoMachines();
    const other = machineA.workspaces.newScene(wa.id, "other");
    await git.commit(wa.path, "A adds other", [other]);
    await machineA.sync.sync(wa.id);

    const mine = machineB.workspaces.newScene(wb.id, "mine");
    await git.commit(wb.path, "B adds mine", [mine]);
    const result = await machineB.sync.sync(wb.id);
    expect(result.outcome).toBe("diverged");
    expect(machineB.sync.info(wb.id).state).toBe("diverged");
    // the remote did not get B's commit
    const onRemote = execFileSync("git", ["log", "--format=%s", "main"], {
      cwd: remote,
    }).toString();
    expect(onRemote).not.toContain("B adds mine");

    const merged = await machineB.sync.resolve(wb.id, "merge");
    expect(merged.outcome).toBe("merged");
    expect(
      machineB.workspaces
        .scenes(wb.id)
        .map((item) => item.path)
        .sort(),
    ).toEqual([mine, other, scenePath].sort());
    expect((await machineB.sync.sync(wb.id)).outcome).toBe("pushed");
    expect((await machineA.sync.sync(wa.id)).outcome).toBe("pulled");
    expect(
      machineA.workspaces
        .scenes(wa.id)
        .map((item) => item.path)
        .sort(),
    ).toEqual([mine, other, scenePath].sort());
  });

  it("a clash in one file: the merge is undone, and a branch of its own keeps both", async () => {
    const { A: machineA, B: machineB, wa, wb, scenePath } = await twoMachines();
    await commitFile(machineA.workspaces, wa.id, scenePath, 2, "A edits");
    await machineA.sync.sync(wa.id);
    await commitFile(machineB.workspaces, wb.id, scenePath, 5, "B edits");
    expect((await machineB.sync.sync(wb.id)).outcome).toBe("diverged");
    const headBefore = await git.head(wb.path);

    const merged = await machineB.sync.resolve(wb.id, "merge");
    expect(merged.outcome).toBe("conflict");
    expect(merged.conflicts).toEqual([scenePath]);
    // nothing changed: same commit, clean tree, B's version intact
    expect(await git.head(wb.path)).toBe(headBefore);
    expect((await git.status(wb.path)).clean).toBe(true);
    expect(
      JSON.parse(machineB.workspaces.readScene(wb.id, scenePath)).elements,
    ).toHaveLength(5);
    expect(machineB.sync.info(wb.id).message).toMatch(/new branch/);

    const branched = await machineB.sync.resolve(wb.id, "branch");
    expect(branched.outcome).toBe("branched");
    expect(branched.branch).toMatch(/^ws\/.+-20261005-1430$/);
    expect((await git.status(wb.path)).branch).toBe(branched.branch);
    const branches = execFileSync("git", ["branch", "--list"], {
      cwd: remote,
    }).toString();
    expect(branches).toContain(branched.branch);
    // main on the remote is still A's
    const mainLog = execFileSync("git", ["log", "--format=%s", "main"], {
      cwd: remote,
    }).toString();
    expect(mainLog).toContain("A edits");
    expect(mainLog).not.toContain("B edits");
    // the new branch syncs by itself from now on
    expect((await machineB.sync.sync(wb.id)).outcome).toBe("in-sync");
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
