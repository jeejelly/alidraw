import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, beforeAll, afterAll } from "vitest";

const { Server, utils } = require("ssh2");

const remote = require("./remote");

const {
  sftp: { OPEN_MODE, STATUS_CODE },
} = utils;

let root;
let server;
let port;
let hostKey;
let fingerprint;

/** a small SFTP server over a real folder: password login only */
const start = () =>
  new Promise((resolve) => {
    const pair = utils.generateKeyPairSync("ed25519");
    hostKey = pair.private;
    const parsed = utils.parseKey(pair.public);
    fingerprint = remote.fingerprintOf(parsed.getPublicSSH());
    server = new Server({ hostKeys: [hostKey] }, (client) => {
      client
        .on("error", () => {})
        .on("authentication", (ctx) =>
          ctx.method === "password" &&
          ctx.username === "u" &&
          ctx.password === "pw"
            ? ctx.accept()
            : ctx.reject(["password"]),
        )
        .on("ready", () =>
          client.on("session", (accept) => {
            const session = accept();
            session.on("sftp", (accept2) => {
              const sftp = accept2();
              const handles = new Map();
              let next = 0;
              const real = (remotePath) =>
                path.join(root, remotePath.replace(/^\/+/, ""));
              const newHandle = (state) => {
                const buffer = Buffer.alloc(4);
                buffer.writeUInt32BE(next++);
                handles.set(buffer.readUInt32BE(0), state);
                return buffer;
              };
              const get = (handleBuffer) =>
                handles.get(handleBuffer.readUInt32BE(0));
              sftp
                .on("REALPATH", (id, remotePath) =>
                  sftp.name(id, [
                    { filename: remotePath, longname: remotePath, attrs: {} },
                  ]),
                )
                .on("STAT", (id, remotePath) => {
                  try {
                    const st = fs.statSync(real(remotePath));
                    sftp.attrs(id, {
                      size: st.size,
                      mode: st.mode,
                      uid: 0,
                      gid: 0,
                      atime: 0,
                      mtime: 0,
                    });
                  } catch {
                    sftp.status(id, STATUS_CODE.NO_SUCH_FILE);
                  }
                })
                .on("MKDIR", (id, remotePath) => {
                  try {
                    fs.mkdirSync(real(remotePath));
                    sftp.status(id, STATUS_CODE.OK);
                  } catch {
                    sftp.status(id, STATUS_CODE.FAILURE);
                  }
                })
                .on("OPEN", (id, remotePath, flags) => {
                  const write = flags & (OPEN_MODE.WRITE | OPEN_MODE.CREAT);
                  try {
                    const fd = fs.openSync(real(remotePath), write ? "w" : "r");
                    sftp.handle(id, newHandle({ fd }));
                  } catch {
                    sftp.status(id, STATUS_CODE.NO_SUCH_FILE);
                  }
                })
                .on("FSTAT", (id, handleBuffer) => {
                  const st = fs.fstatSync(get(handleBuffer).fd);
                  sftp.attrs(id, {
                    size: st.size,
                    mode: st.mode,
                    uid: 0,
                    gid: 0,
                    atime: 0,
                    mtime: 0,
                  });
                })
                .on("FSETSTAT", (id) => sftp.status(id, STATUS_CODE.OK))
                .on("WRITE", (id, handleBuffer, offset, data) => {
                  fs.writeSync(
                    get(handleBuffer).fd,
                    data,
                    0,
                    data.length,
                    offset,
                  );
                  sftp.status(id, STATUS_CODE.OK);
                })
                .on("READ", (id, handleBuffer, offset, length) => {
                  const buf = Buffer.alloc(length);
                  const bytesRead = fs.readSync(
                    get(handleBuffer).fd,
                    buf,
                    0,
                    length,
                    offset,
                  );
                  bytesRead
                    ? sftp.data(id, buf.subarray(0, bytesRead))
                    : sftp.status(id, STATUS_CODE.EOF);
                })
                .on("CLOSE", (id, handleBuffer) => {
                  const state = get(handleBuffer);
                  if (state.fd !== undefined) {
                    fs.closeSync(state.fd);
                  }
                  handles.delete(handleBuffer.readUInt32BE(0));
                  sftp.status(id, STATUS_CODE.OK);
                })
                .on("OPENDIR", (id, remotePath) =>
                  fs.existsSync(real(remotePath))
                    ? sftp.handle(
                        id,
                        newHandle({ dir: real(remotePath), done: false }),
                      )
                    : sftp.status(id, STATUS_CODE.NO_SUCH_FILE),
                )
                .on("READDIR", (id, handleBuffer) => {
                  const state = get(handleBuffer);
                  if (state.done) {
                    return sftp.status(id, STATUS_CODE.EOF);
                  }
                  state.done = true;
                  sftp.name(
                    id,
                    fs.readdirSync(state.dir).map((entryName) => ({
                      filename: entryName,
                      longname: entryName,
                      attrs: {},
                    })),
                  );
                })
                .on("RENAME", (id, from, to) => {
                  fs.renameSync(real(from), real(to));
                  sftp.status(id, STATUS_CODE.OK);
                })
                .on("REMOVE", (id, remotePath) => {
                  fs.rmSync(real(remotePath), { force: true });
                  sftp.status(id, STATUS_CODE.OK);
                });
            });
          }),
        );
    });
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      resolve();
    });
  });

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "sftp-"));
  await start();
});
afterAll(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const cfg = (extra = {}) => ({
  protocol: "sftp",
  host: "127.0.0.1",
  port,
  user: "u",
  dir: "/backup/images",
  ...extra,
});

describe("sftp transport", () => {
  it("refuses an unknown server key and shows its fingerprint", async () => {
    await expect(remote.connect(cfg(), "pw")).rejects.toMatchObject({
      code: "HOSTKEY_UNKNOWN",
      fingerprint,
    });
  });

  it("refuses a changed key", async () => {
    await expect(
      remote.connect(cfg({ hostKey: "SHA256:AAAA" }), "pw"),
    ).rejects.toMatchObject({ code: "HOSTKEY_CHANGED", fingerprint });
  });

  it("refuses a wrong password", async () => {
    await expect(
      remote.connect(cfg({ hostKey: fingerprint }), "nope"),
    ).rejects.toThrow();
  });

  it("creates the folder, uploads, lists and downloads", async () => {
    const conn = await remote.connect(cfg({ hostKey: fingerprint }), "pw");
    await conn.ensure();
    const name = `${"b".repeat(64)}.png`;
    const src = path.join(root, "src.bin");
    fs.writeFileSync(src, "hello bytes");
    await conn.put(src, name);
    expect(await conn.list()).toEqual([name]);
    const dest = path.join(root, "dest.bin");
    await conn.get(name, dest);
    expect(fs.readFileSync(dest, "utf8")).toBe("hello bytes");
    await expect(conn.put(src, "../escape")).rejects.toThrow(/asset name/);
    await conn.close();
  });
});
