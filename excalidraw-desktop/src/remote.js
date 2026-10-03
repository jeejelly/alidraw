const fs = require("node:fs");
const crypto = require("node:crypto");

/**
 * A file server as the backup sees it: a flat folder of files named by content.
 * Every transport offers list / put / get / close and nothing else.
 */

const fingerprintOf = (key) =>
  `SHA256:${crypto
    .createHash("sha256")
    .update(key)
    .digest("base64")
    .replace(/=+$/, "")}`;

const safeName = (name) => {
  if (!/^[0-9a-f]{64}\.[a-z0-9]{1,5}$/.test(name)) {
    throw new Error("not an asset name");
  }
  return name;
};

const join = (dir, name) => `${dir.replace(/\/+$/, "")}/${safeName(name)}`;

class HostKeyError extends Error {
  constructor(fingerprint, changed) {
    super(
      changed
        ? `The server's key changed (${fingerprint}). It may not be the same server.`
        : `Unknown server key ${fingerprint}. Check it, then trust it.`,
    );
    this.code = changed ? "HOSTKEY_CHANGED" : "HOSTKEY_UNKNOWN";
    this.fingerprint = fingerprint;
  }
}

const connectSftp = async (cfg, password) => {
  const { Client } = require("ssh2");
  const client = new Client();
  let seen = null;
  await new Promise((resolve, reject) => {
    client
      .on("ready", resolve)
      .on("error", (error) =>
        reject(seen && !cfg.hostKey ? new HostKeyError(seen, false) : error),
      )
      .connect({
        host: cfg.host,
        port: cfg.port || 22,
        username: cfg.user,
        password,
        readyTimeout: 15000,
        // the key is pinned: the first one is shown to the user, a different one later is refused
        hostVerifier: (key) => {
          seen = fingerprintOf(key);
          return !!cfg.hostKey && cfg.hostKey === seen;
        },
      });
  }).catch((error) => {
    if (seen && cfg.hostKey && cfg.hostKey !== seen) {
      throw new HostKeyError(seen, true);
    }
    throw error;
  });
  const sftp = await new Promise((resolve, reject) =>
    client.sftp((error, sftpSession) =>
      error ? reject(error) : resolve(sftpSession),
    ),
  );
  const sftpCall = (fn, ...args) =>
    new Promise((resolve, reject) =>
      sftp[fn](...args, (error, value) =>
        error ? reject(error) : resolve(value),
      ),
    );
  const dir = cfg.dir || ".";
  return {
    async ensure() {
      try {
        await sftpCall("stat", dir);
      } catch {
        let acc = dir.startsWith("/") ? "" : ".";
        for (const part of dir.split("/").filter(Boolean)) {
          acc = acc ? `${acc}/${part}` : part;
          await sftpCall("mkdir", acc).catch(() => {});
        }
      }
    },
    async list() {
      return (await sftpCall("readdir", dir)).map((entry) => entry.filename);
    },
    async put(localPath, name) {
      const target = join(dir, name);
      // written under another name, then renamed: a cut connection never leaves a half file
      const tmp = `${target}.part`;
      await sftpCall("fastPut", localPath, tmp);
      await sftpCall("unlink", target).catch(() => {});
      await sftpCall("rename", tmp, target);
    },
    get: (name, localPath) => sftpCall("fastGet", join(dir, name), localPath),
    close: async () => client.end(),
    fingerprint: () => seen,
  };
};

const connectFtp = async (cfg, password) => {
  const ftp = require("basic-ftp");
  const client = new ftp.Client(20000);
  const secure = cfg.protocol === "ftps";
  if (!secure && cfg.insecureOk !== true) {
    throw new Error("plain FTP sends the password unprotected: confirm first");
  }
  await client.access({
    host: cfg.host,
    port: cfg.port || 21,
    user: cfg.user,
    password,
    secure,
    // certificates are checked; there is no switch to turn that off
    secureOptions: secure ? { servername: cfg.host } : undefined,
  });
  const dir = cfg.dir || "/";
  return {
    ensure: () => client.ensureDir(dir),
    async list() {
      await client.cd(dir);
      return (await client.list()).map((entry) => entry.name);
    },
    async put(localPath, name) {
      safeName(name);
      await client.cd(dir);
      await client.uploadFrom(fs.createReadStream(localPath), `${name}.part`);
      await client.remove(name, true).catch(() => {});
      await client.rename(`${name}.part`, name);
    },
    async get(name, localPath) {
      safeName(name);
      await client.cd(dir);
      await client.downloadTo(localPath, name);
    },
    close: async () => client.close(),
    fingerprint: () => null,
  };
};

const connect = (cfg, password) => {
  if (!cfg || !cfg.host || !cfg.user) {
    throw new Error("the server needs a host and a user");
  }
  if (/[\s/\\]/.test(cfg.host)) {
    throw new Error("invalid host");
  }
  return cfg.protocol === "sftp"
    ? connectSftp(cfg, password)
    : connectFtp(cfg, password);
};

module.exports = {
  connect,
  fingerprintOf,
  safeName,
  HostKeyError,
};
