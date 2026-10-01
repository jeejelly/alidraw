const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const KDF = { N: 2 ** 15, r: 8, p: 1 };

const seal = (key, plain, aad) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  if (aad) {
    cipher.setAAD(Buffer.from(aad));
  }
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
  };
};

const open = (key, box, aad) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(box.iv, "base64"),
  );
  if (aad) {
    decipher.setAAD(Buffer.from(aad));
  }
  decipher.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(box.ct, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

/**
 * The passwords manifest of this machine. Server passwords are never stored in
 * clear: each is ciphered with a key derived from one random seed, and the seed
 * itself is ciphered with a key derived from a passphrase. The passphrase is
 * asked once per session; the deciphered seed lives only in memory.
 */
class Secrets {
  /**
   * `keychain` (optional) is the OS store: { available(), encrypt(text) -> Buffer,
   * decrypt(Buffer) -> text }. With it the seed can be protected by the OS login
   * instead of a passphrase.
   */
  constructor(dir, keychain = null) {
    this.file = path.join(dir, "secrets.json");
    this.seed = null;
    this.keychain = keychain;
  }

  read() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, "utf8"));
      return data && data.seed && (data.kdf || data.mode === "keychain")
        ? data
        : null;
    } catch {
      return null;
    }
  }

  write(data) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  keychainAvailable() {
    try {
      return !!this.keychain && this.keychain.available() === true;
    } catch {
      return false;
    }
  }

  status() {
    const data = this.read();
    return {
      exists: !!data,
      unlocked: !!this.seed,
      mode: data
        ? data.mode === "keychain"
          ? "keychain"
          : "passphrase"
        : null,
      keychainAvailable: this.keychainAvailable(),
    };
  }

  /** the seed protected by the OS login: nothing to type, nothing a passphrase could leak */
  createWithKeychain() {
    if (!this.keychainAvailable()) {
      throw new Error("the OS keychain is not available here");
    }
    if (this.read()) {
      throw new Error("a passwords manifest already exists");
    }
    const seed = crypto.randomBytes(32);
    this.write({
      version: 1,
      mode: "keychain",
      seed: {
        os: this.keychain.encrypt(seed.toString("base64")).toString("base64"),
      },
      entries: {},
    });
    this.seed = seed;
  }

  kek(passphrase, kdf) {
    return crypto.scryptSync(
      String(passphrase),
      Buffer.from(kdf.salt, "base64"),
      32,
      { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 128 * 1024 * 1024 },
    );
  }

  /** the seed is the "global password seed": random, ciphered by the passphrase */
  create(passphrase) {
    if (typeof passphrase !== "string" || passphrase.length < 8) {
      throw new Error("the passphrase needs at least 8 characters");
    }
    if (this.read()) {
      throw new Error("a passwords manifest already exists");
    }
    const kdf = { ...KDF, salt: crypto.randomBytes(16).toString("base64") };
    const seed = crypto.randomBytes(32);
    this.write({
      version: 1,
      kdf,
      seed: seal(this.kek(passphrase, kdf), seed.toString("base64"), "seed"),
      entries: {},
    });
    this.seed = seed;
  }

  unlock(passphrase) {
    const data = this.read();
    if (!data) {
      throw new Error("no passwords manifest yet");
    }
    if (data.mode === "keychain") {
      try {
        this.seed = Buffer.from(
          this.keychain.decrypt(Buffer.from(data.seed.os, "base64")),
          "base64",
        );
      } catch {
        this.seed = null;
        throw new Error("the OS keychain could not open the passwords");
      }
      return;
    }
    try {
      this.seed = Buffer.from(
        open(this.kek(passphrase, data.kdf), data.seed, "seed"),
        "base64",
      );
    } catch {
      this.seed = null;
      throw new Error("wrong passphrase");
    }
  }

  lock() {
    this.seed = null;
  }

  entryKey(id) {
    if (!this.seed) {
      throw new Error("unlock the passwords first");
    }
    return Buffer.from(
      crypto.hkdfSync(
        "sha256",
        this.seed,
        Buffer.alloc(0),
        `password:${id}`,
        32,
      ),
    );
  }

  setPassword(id, password) {
    const data = this.read();
    const key = this.entryKey(id);
    data.entries[id] = seal(key, String(password), id);
    this.write(data);
  }

  getPassword(id) {
    const key = this.entryKey(id);
    const box = this.read()?.entries?.[id];
    return box ? open(key, box, id) : null;
  }

  has(id) {
    return !!this.read()?.entries?.[id];
  }

  remove(id) {
    const data = this.read();
    if (data?.entries?.[id]) {
      delete data.entries[id];
      this.write(data);
    }
  }
}

module.exports = { Secrets };
