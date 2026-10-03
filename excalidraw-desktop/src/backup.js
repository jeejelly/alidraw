const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const git = require("./git");
const remote = require("./remote");
const { resolveInside } = require("./paths");

const NAME = /^[0-9a-f]{64}\.[a-z0-9]{1,5}$/;
const PROTOCOLS = ["sftp", "ftps", "ftp"];
const IGNORE_LINE = "/assets/";

const sha256 = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/**
 * The binary side of a workspace: images kept as `assets/<hash>.<ext>` are copied
 * to a file server (backup) and fetched back from it when missing (work server).
 * Connections are made here, in the main process, to the host the user entered.
 */
class Backup {
  constructor({
    workspaces,
    registry,
    secrets,
    isPaused,
    emit = () => {},
    connect = remote.connect,
    delayMs = 3000,
  }) {
    this.workspaces = workspaces;
    this.registry = registry;
    this.secrets = secrets;
    this.isPaused = isPaused;
    this.emit = emit;
    this.connect = connect;
    this.delayMs = delayMs;
    this.timers = new Map();
    this.running = new Map();
    this.state = new Map();
  }

  config(id) {
    return this.registry.get(id)?.settings?.server ?? null;
  }

  /** what the page may see: never the password */
  publicConfig(id) {
    const cfg = this.config(id);
    return {
      server: cfg,
      hasPassword: this.secrets.has(id),
      keepOut: this.workspaces.meta(id).binaries === "server",
      state: this.state.get(id) ?? null,
    };
  }

  setConfig(id, input, password) {
    const prev = this.config(id);
    if (input === null) {
      this.registry.update(id, { settings: { server: null } });
      this.secrets.remove(id);
      return this.publicConfig(id);
    }
    const protocol = String(input.protocol);
    if (!PROTOCOLS.includes(protocol)) {
      throw new Error("choose sftp, ftps or ftp");
    }
    const host = String(input.host ?? "").trim();
    const user = String(input.user ?? "").trim();
    if (!host || /[\s/\\]/.test(host) || !user) {
      throw new Error("the server needs a host and a user");
    }
    const port = Number(input.port) || (protocol === "sftp" ? 22 : 21);
    if (port < 1 || port > 65535) {
      throw new Error("invalid port");
    }
    const dir = String(input.dir ?? "").trim() || "/";
    if (dir.includes("\0") || dir.split("/").includes("..")) {
      throw new Error("invalid folder");
    }
    const same = prev && prev.host === host && prev.port === port;
    const cfg = {
      protocol,
      host,
      port,
      user,
      dir,
      // plain FTP only after the user confirmed the warning
      insecureOk: protocol === "ftp" && input.insecureOk === true,
      // a pinned host key stays only for the same server
      hostKey: protocol === "sftp" && same ? prev.hostKey : undefined,
    };
    if (typeof password === "string" && password) {
      this.secrets.setPassword(id, password);
    }
    this.registry.update(id, { settings: { server: cfg } });
    return this.publicConfig(id);
  }

  trustHostKey(id, fingerprint) {
    const cfg = this.config(id);
    if (
      !cfg ||
      cfg.protocol !== "sftp" ||
      !/^SHA256:[A-Za-z0-9+/]+$/.test(fingerprint)
    ) {
      throw new Error("nothing to trust");
    }
    this.registry.update(id, {
      settings: { server: { ...cfg, hostKey: fingerprint } },
    });
    return this.publicConfig(id);
  }

  /** where it cannot run, and why */
  blocker(id) {
    if (this.isPaused()) {
      return "paused";
    }
    if (!this.config(id)) {
      return "no-server";
    }
    if (!this.secrets.status().unlocked) {
      return "locked";
    }
    if (!this.secrets.has(id)) {
      return "no-password";
    }
    return null;
  }

  async session(id, fn) {
    const cfg = this.config(id);
    const conn = await this.connect(cfg, this.secrets.getPassword(id));
    try {
      await conn.ensure();
      return await fn(conn);
    } finally {
      await conn.close().catch(() => {});
    }
  }

  localAssets(id) {
    const dir = path.join(this.workspaces.root(id), "assets");
    try {
      return fs.readdirSync(dir).filter((fileName) => NAME.test(fileName));
    } catch {
      return [];
    }
  }

  fail(error) {
    return {
      outcome: "error",
      code: error.code ?? null,
      fingerprint: error.fingerprint ?? null,
      message: error.message,
    };
  }

  /** a result shown in the panel and sent to the page */
  report(id, result) {
    this.state.set(id, { ...result, at: Date.now() });
    this.emit({ type: "backup", id, ...result });
    return result;
  }

  /** copies the assets the server lacks; one run per workspace at a time */
  backupNow(id) {
    const blocked = this.blocker(id);
    if (blocked) {
      return Promise.resolve({ outcome: blocked });
    }
    if (this.running.has(id)) {
      return this.running.get(id);
    }
    const job = (async () => {
      try {
        const result = await this.session(id, async (conn) => {
          const have = new Set(await conn.list());
          const todo = this.localAssets(id).filter(
            (fileName) => !have.has(fileName),
          );
          const failed = [];
          let uploaded = 0;
          for (const name of todo) {
            try {
              await conn.put(
                resolveInside(this.workspaces.root(id), `assets/${name}`),
                name,
              );
              uploaded++;
            } catch (error) {
              failed.push({ name, message: error.message });
            }
          }
          return {
            outcome: "done",
            uploaded,
            already: this.localAssets(id).length - todo.length,
            failed,
          };
        });
        return this.report(id, result);
      } catch (error) {
        return this.report(id, this.fail(error));
      } finally {
        this.running.delete(id);
      }
    })();
    this.running.set(id, job);
    return job;
  }

  /** after an asset is written: copy it soon, quietly (a failure is retried next time) */
  queue(id) {
    if (this.blocker(id)) {
      return;
    }
    clearTimeout(this.timers.get(id));
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id);
        this.backupNow(id).catch(() => {});
      }, this.delayMs),
    );
  }

  /** one missing asset, downloaded and checked against its own name */
  async fetch(id, rel) {
    const name = String(rel).replace(/^assets\//, "");
    if (!NAME.test(name)) {
      throw new Error("not an asset");
    }
    const blocked = this.blocker(id);
    if (blocked) {
      throw new Error(
        `the image is not here and the server is unavailable (${blocked})`,
      );
    }
    const target = resolveInside(this.workspaces.root(id), `assets/${name}`);
    await this.session(id, (conn) => this.download(conn, name, target));
    return rel;
  }

  async download(conn, name, target) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.part`;
    try {
      await conn.get(name, tmp);
      // the name is the content's hash: anything else is damage or tampering
      if (sha256(tmp) !== name.split(".")[0]) {
        throw new Error(`${name} on the server does not match its name`);
      }
      fs.renameSync(tmp, target);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  async fetchAll(id) {
    const blocked = this.blocker(id);
    if (blocked) {
      return { outcome: blocked };
    }
    try {
      return this.report(
        id,
        await this.session(id, async (conn) => {
          const local = new Set(this.localAssets(id));
          const missing = (await conn.list()).filter(
            (fileName) => NAME.test(fileName) && !local.has(fileName),
          );
          const failed = [];
          let downloaded = 0;
          for (const name of missing) {
            try {
              await this.download(
                conn,
                name,
                resolveInside(this.workspaces.root(id), `assets/${name}`),
              );
              downloaded++;
            } catch (error) {
              failed.push({ name, message: error.message });
            }
          }
          return { outcome: "fetched", downloaded, failed };
        }),
      );
    } catch (error) {
      return this.report(id, this.fail(error));
    }
  }

  async test(id) {
    const blocked = this.blocker(id);
    if (blocked) {
      return { outcome: blocked };
    }
    try {
      return await this.session(id, async (conn) => ({
        outcome: "ok",
        files: (await conn.list()).filter((fileName) => NAME.test(fileName))
          .length,
      }));
    } catch (error) {
      return this.fail(error);
    }
  }

  /**
   * Keep binaries out of git: only once every local asset is on the server, so
   * nothing can exist in one place only. The files stay on disk, untracked.
   */
  async setKeepOut(id, on) {
    const root = this.workspaces.root(id);
    const ignore = path.join(root, ".gitignore");
    const lines = fs.existsSync(ignore)
      ? fs.readFileSync(ignore, "utf8").split("\n")
      : [];
    const without = lines.filter((line) => line.trim() !== IGNORE_LINE);
    if (!on) {
      fs.writeFileSync(ignore, `${without.join("\n").replace(/\n*$/, "")}\n`);
      this.workspaces.setMeta(id, { binaries: "git" });
      return this.publicConfig(id);
    }
    const result = await this.backupNow(id);
    if (result.outcome !== "done" || result.failed.length) {
      throw new Error(
        result.outcome === "done"
          ? `${result.failed.length} image(s) could not be copied to the server`
          : `the server is not reachable (${result.outcome}${
              result.message ? `: ${result.message}` : ""
            })`,
      );
    }
    const kept = without.filter(
      (line, index, allLines) =>
        !(line === "" && index === allLines.length - 1),
    );
    fs.writeFileSync(
      ignore,
      `${[...kept, "# binaries live on the file server", IGNORE_LINE].join(
        "\n",
      )}\n`,
    );
    if (await git.isRepo(root)) {
      await git.run(root, [
        "rm",
        "-r",
        "--cached",
        "--ignore-unmatch",
        "-q",
        "assets",
      ]);
    }
    this.workspaces.setMeta(id, { binaries: "server" });
    return this.publicConfig(id);
  }
}

module.exports = { Backup };
