import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

const { Backup } = require("./backup");
const remote = require("./remote");
const { Registry } = require("./registry");
const { Secrets } = require("./secrets");
const { Workspaces } = require("./workspace");

let tmp;
let ws;
let registry;
let secrets;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bk-"));
  fs.mkdirSync(path.join(tmp, "data"));
  fs.mkdirSync(path.join(tmp, "proj"));
  registry = new Registry(path.join(tmp, "data"));
  ws = new Workspaces({ registry });
  secrets = new Secrets(path.join(tmp, "data"));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

const png = (number) => Buffer.from(`image-${number}`).toString("base64");

describe("secrets manifest", () => {
  it("never stores a password in clear and needs the passphrase", () => {
    secrets.create("correct horse battery");
    secrets.setPassword("w1", "s3cret-pass");
    const raw = fs.readFileSync(secrets.file, "utf8");
    expect(raw).not.toContain("s3cret-pass");
    expect(secrets.getPassword("w1")).toBe("s3cret-pass");

    const later = new Secrets(path.join(tmp, "data"));
    expect(later.status()).toMatchObject({ exists: true, unlocked: false });
    expect(() => later.getPassword("w1")).toThrow(/unlock/);
    expect(() => later.unlock("wrong passphrase")).toThrow(/wrong passphrase/);
    later.unlock("correct horse battery");
    expect(later.getPassword("w1")).toBe("s3cret-pass");
    later.lock();
    expect(later.status().unlocked).toBe(false);
  });

  it("ciphers each entry under its own key and name", () => {
    secrets.create("correct horse battery");
    secrets.setPassword("a", "same");
    secrets.setPassword("b", "same");
    const { entries } = JSON.parse(fs.readFileSync(secrets.file, "utf8"));
    expect(entries.a.ct).not.toBe(entries.b.ct);
    // an entry moved under another name no longer opens
    const data = JSON.parse(fs.readFileSync(secrets.file, "utf8"));
    data.entries.b = data.entries.a;
    fs.writeFileSync(secrets.file, JSON.stringify(data));
    expect(() => secrets.getPassword("b")).toThrow();
  });

  it("asks for a real passphrase and keeps the file private", () => {
    expect(() => secrets.create("short")).toThrow(/8 characters/);
    secrets.create("correct horse battery");
    if (process.platform !== "win32") {
      expect(fs.statSync(secrets.file).mode & 0o077).toBe(0);
    }
    expect(() => secrets.create("another passphrase")).toThrow(/already/);
  });
});

/** a transport over a plain folder */
const folderConnect =
  (dir, log = []) =>
  async () => ({
    ensure: async () => fs.mkdirSync(dir, { recursive: true }),
    list: async () => fs.readdirSync(dir),
    put: async (src, name) => {
      log.push(`put:${name}`);
      fs.copyFileSync(src, path.join(dir, name));
    },
    get: async (name, dest) => {
      log.push(`get:${name}`);
      fs.copyFileSync(path.join(dir, name), dest);
    },
    close: async () => {},
  });

const setup = (connect, paused = { v: false }) => {
  return ws
    .create({ name: "P", parent: path.join(tmp, "proj"), useGit: false })
    .then((project) => {
      const backup = new Backup({
        workspaces: ws,
        registry,
        secrets,
        isPaused: () => paused.v,
        connect,
        delayMs: 5,
      });
      return { id: project.id, backup, paused };
    });
};

describe("backup", () => {
  it("copies new assets to the server once, by content", async () => {
    const dir = path.join(tmp, "server");
    const log = [];
    const { id, backup } = await setup(folderConnect(dir, log));
    secrets.create("correct horse battery");
    backup.setConfig(id, { protocol: "sftp", host: "h", user: "u" }, "pw");
    ws.writeAsset(id, "image/png", png(1));
    ws.writeAsset(id, "image/png", png(2));

    let result = await backup.backupNow(id);
    expect(result).toMatchObject({ outcome: "done", uploaded: 2, failed: [] });
    result = await backup.backupNow(id);
    expect(result).toMatchObject({ uploaded: 0, already: 2 });
    expect(log.filter((line) => line.startsWith("put"))).toHaveLength(2);
  });

  it("fetches a missing asset and checks it against its name", async () => {
    const dir = path.join(tmp, "server");
    const { id, backup } = await setup(folderConnect(dir));
    secrets.create("correct horse battery");
    backup.setConfig(id, { protocol: "sftp", host: "h", user: "u" }, "pw");
    const { path: rel } = ws.writeAsset(id, "image/png", png(3));
    await backup.backupNow(id);
    fs.rmSync(path.join(ws.root(id), rel));
    await backup.fetch(id, rel);
    expect(ws.readAsset(id, rel)).toBe(png(3));

    // a server that returns other bytes is refused, nothing is kept
    fs.rmSync(path.join(ws.root(id), rel));
    fs.writeFileSync(path.join(dir, path.basename(rel)), "tampered");
    await expect(backup.fetch(id, rel)).rejects.toThrow(/does not match/);
    expect(fs.existsSync(path.join(ws.root(id), rel))).toBe(false);
  });

  it("fetches everything the server has that this folder lacks", async () => {
    const dir = path.join(tmp, "server");
    const { id, backup } = await setup(folderConnect(dir));
    secrets.create("correct horse battery");
    backup.setConfig(id, { protocol: "sftp", host: "h", user: "u" }, "pw");
    const firstPath = ws.writeAsset(id, "image/png", png(4)).path;
    const secondPath = ws.writeAsset(id, "image/jpeg", png(5)).path;
    await backup.backupNow(id);
    fs.rmSync(path.join(ws.root(id), firstPath));
    fs.rmSync(path.join(ws.root(id), secondPath));
    expect(await backup.fetchAll(id)).toMatchObject({ downloaded: 2 });
    expect(ws.readAsset(id, firstPath)).toBe(png(4));
  });

  it("does nothing while paused, locked, or without a server", async () => {
    const dir = path.join(tmp, "server");
    const log = [];
    const { id, backup, paused } = await setup(folderConnect(dir, log));
    expect(await backup.backupNow(id)).toEqual({ outcome: "no-server" });
    backup.setConfig(id, { protocol: "sftp", host: "h", user: "u" });
    expect(await backup.backupNow(id)).toEqual({ outcome: "locked" });
    secrets.create("correct horse battery");
    expect(await backup.backupNow(id)).toEqual({ outcome: "no-password" });
    backup.setConfig(id, { protocol: "sftp", host: "h", user: "u" }, "pw");
    paused.v = true;
    expect(await backup.backupNow(id)).toEqual({ outcome: "paused" });
    await expect(
      backup.fetch(id, `assets/${"a".repeat(64)}.png`),
    ).rejects.toThrow(/paused/);
    expect(log).toEqual([]);
  });

  it("validates the server and never exposes the password", async () => {
    const { id, backup } = await setup(folderConnect(path.join(tmp, "s")));
    secrets.create("correct horse battery");
    expect(() =>
      backup.setConfig(id, { protocol: "scp", host: "h", user: "u" }),
    ).toThrow(/sftp, ftps or ftp/);
    expect(() =>
      backup.setConfig(id, { protocol: "sftp", host: "a/b", user: "u" }),
    ).toThrow(/host/);
    expect(() =>
      backup.setConfig(id, {
        protocol: "sftp",
        host: "h",
        user: "u",
        dir: "/a/../b",
      }),
    ).toThrow(/folder/);
    const pub = backup.setConfig(
      id,
      { protocol: "ftp", host: "h", user: "u" },
      "topsecret",
    );
    expect(JSON.stringify(pub)).not.toContain("topsecret");
    expect(pub).toMatchObject({ hasPassword: true });
    expect(pub.server.insecureOk).toBe(false);
    // the registry (readable by the page through settings) holds no password either
    expect(fs.readFileSync(registry.file, "utf8")).not.toContain("topsecret");
    expect(backup.setConfig(id, null).server).toBeNull();
    expect(secrets.has(id)).toBe(false);
  });

  it("keeps binaries out of git only once they are all on the server", async () => {
    const dir = path.join(tmp, "server");
    const { id, backup } = await setup(folderConnect(dir));
    secrets.create("correct horse battery");
    backup.setConfig(id, { protocol: "sftp", host: "h", user: "u" }, "pw");
    ws.writeAsset(id, "image/png", png(6));
    const bad = new Backup({
      workspaces: ws,
      registry,
      secrets,
      isPaused: () => false,
      connect: async () => {
        throw new Error("refused");
      },
    });
    await expect(bad.setKeepOut(id, true)).rejects.toThrow(/not reachable/);
    expect(ws.meta(id).binaries).toBeUndefined();

    await backup.setKeepOut(id, true);
    expect(ws.meta(id).binaries).toBe("server");
    expect(
      fs.readFileSync(path.join(ws.root(id), ".gitignore"), "utf8"),
    ).toContain("/assets/");
    await backup.setKeepOut(id, false);
    expect(
      fs.readFileSync(path.join(ws.root(id), ".gitignore"), "utf8"),
    ).not.toContain("/assets/");
  });

  it("refuses names that are not content hashes", () => {
    expect(() => remote.safeName("../../etc/passwd")).toThrow();
    expect(() => remote.safeName(`${"a".repeat(64)}.png`)).not.toThrow();
  });
});

describe("secrets in the OS keychain", () => {
  const keychain = {
    available: () => true,
    encrypt: (text) => Buffer.from(`os:${text}`),
    decrypt: (buffer) => buffer.toString().replace(/^os:/, ""),
  };
  it("keeps passwords without a passphrase and opens by itself", () => {
    const firstSecrets = new Secrets(path.join(tmp, "data"), keychain);
    firstSecrets.createWithKeychain();
    firstSecrets.setPassword("w", "kc-secret");
    expect(firstSecrets.status()).toMatchObject({
      mode: "keychain",
      unlocked: true,
    });
    expect(fs.readFileSync(firstSecrets.file, "utf8")).not.toContain(
      "kc-secret",
    );
    const secondSecrets = new Secrets(path.join(tmp, "data"), keychain);
    expect(secondSecrets.status().unlocked).toBe(false);
    secondSecrets.unlock();
    expect(secondSecrets.getPassword("w")).toBe("kc-secret");
  });
  it("is refused where there is no keychain", () => {
    const passphraseSecrets = new Secrets(path.join(tmp, "data"), {
      ...keychain,
      available: () => false,
    });
    expect(() => passphraseSecrets.createWithKeychain()).toThrow(
      /not available/,
    );
    expect(new Secrets(path.join(tmp, "data")).keychainAvailable()).toBe(false);
  });
});
