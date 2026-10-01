const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

/** The machine's list of workspaces: where each one is, and this machine's settings for it. */
class Registry {
  constructor(dir) {
    this.file = path.join(dir, "workspaces.json");
  }

  readAll() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, "utf8"));
      return {
        workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
        app: data.app && typeof data.app === "object" ? data.app : {},
      };
    } catch {
      return { workspaces: [], app: {} };
    }
  }

  read() {
    return this.readAll().workspaces;
  }

  writeAll(all) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, ...all }, null, 2));
    fs.renameSync(tmp, this.file);
  }

  write(list) {
    this.writeAll({ ...this.readAll(), workspaces: list });
  }

  /** settings of the app itself on this machine (not of one workspace) */
  appSettings() {
    return this.readAll().app;
  }

  setAppSettings(patch) {
    const all = this.readAll();
    this.writeAll({ ...all, app: { ...all.app, ...patch } });
    return this.appSettings();
  }

  /** most recently opened first */
  list() {
    return [...this.read()].sort(
      (a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0),
    );
  }

  get(id) {
    return this.read().find((w) => w.id === id) ?? null;
  }

  byPath(p) {
    const full = path.resolve(p);
    return this.read().find((w) => path.resolve(w.path) === full) ?? null;
  }

  add({ name, path: root, settings }) {
    const existing = this.byPath(root);
    if (existing) {
      return this.update(existing.id, { name, lastOpened: Date.now() });
    }
    const entry = {
      id: randomUUID(),
      name,
      path: path.resolve(root),
      lastOpened: Date.now(),
      settings: { autoCommit: true, delaySec: 60, ...settings },
    };
    this.write([...this.read(), entry]);
    return entry;
  }

  update(id, patch) {
    let found = null;
    this.write(
      this.read().map((w) => {
        if (w.id !== id) {
          return w;
        }
        found = {
          ...w,
          ...patch,
          settings: { ...w.settings, ...(patch.settings ?? {}) },
        };
        return found;
      }),
    );
    return found;
  }

  remove(id) {
    this.write(this.read().filter((w) => w.id !== id));
  }
}

module.exports = { Registry };
