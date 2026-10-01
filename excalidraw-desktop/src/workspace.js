const fs = require("node:fs");
const path = require("node:path");

const git = require("./git");
const {
  slug,
  resolveInside,
  isSceneName,
  toRel,
  SCENE_EXT,
} = require("./paths");

const META = "workspace.json";
const SKIP = new Set(["node_modules", ".git", ".excalidraw-local"]);

const emptyScene = () =>
  JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: "workspace",
      elements: [],
      appState: {},
      files: {},
    },
    null,
    2,
  );

/** Atomic write: a crash leaves the old file or the new one, never half of one. */
const writeAtomic = (full, data) => {
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const tmp = `${full}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, full);
};

/**
 * Workspaces: named project folders, git-backed. Everything the page may do
 * to a workspace goes through here, confined to the workspace's folder.
 */
class Workspaces {
  constructor({ registry }) {
    this.registry = registry;
  }

  root(id) {
    const w = this.registry.get(id);
    if (!w) {
      throw new Error("unknown workspace");
    }
    if (!fs.existsSync(w.path)) {
      throw new Error(`the folder of "${w.name}" is missing: ${w.path}`);
    }
    return w.path;
  }

  list() {
    return this.registry
      .list()
      .map((w) => ({ ...w, exists: fs.existsSync(w.path) }));
  }

  /** a new folder `<parent>/<name>`, with `git init` unless told otherwise */
  async create({ name, parent, useGit = true }) {
    const title = String(name ?? "").trim();
    if (!title) {
      throw new Error("a workspace needs a name");
    }
    if (!parent || !fs.statSync(parent).isDirectory()) {
      throw new Error("choose the folder to create it in");
    }
    const root = path.join(parent, slug(title));
    if (fs.existsSync(root) && fs.readdirSync(root).length) {
      throw new Error(`${root} already exists and is not empty`);
    }
    fs.mkdirSync(root, { recursive: true });
    writeAtomic(
      path.join(root, META),
      `${JSON.stringify(
        {
          version: 1,
          name: title,
          assets: "embedded",
          commitMessage: "Update {files}",
        },
        null,
        2,
      )}\n`,
    );
    if (useGit) {
      if (!(await git.version())) {
        throw new Error("git is not installed");
      }
      await git.init(root);
      writeAtomic(path.join(root, ".gitignore"), git.DEFAULT_IGNORE);
      await git.commit(root, "Create workspace");
    }
    return this.registry.add({ name: title, path: root });
  }

  /** an existing folder becomes a workspace (its `workspace.json` is read, or made) */
  async open(folder, { useGit = true } = {}) {
    if (
      !folder ||
      !fs.existsSync(folder) ||
      !fs.statSync(folder).isDirectory()
    ) {
      throw new Error("not a folder");
    }
    const metaFile = path.join(folder, META);
    let name = path.basename(folder);
    if (fs.existsSync(metaFile)) {
      try {
        name = JSON.parse(fs.readFileSync(metaFile, "utf8")).name || name;
      } catch {
        // an unreadable file is left alone
      }
    } else {
      writeAtomic(
        metaFile,
        `${JSON.stringify(
          {
            version: 1,
            name,
            assets: "embedded",
            commitMessage: "Update {files}",
          },
          null,
          2,
        )}\n`,
      );
    }
    const entry = this.registry.add({ name, path: folder });
    // a folder that becomes a workspace is put under git, when git is there
    let gitNote = null;
    if (useGit && (await git.version())) {
      if (await git.isRepo(folder)) {
        await git.ensureIdentity(folder);
      } else {
        await git.init(folder);
        if (!fs.existsSync(path.join(folder, ".gitignore"))) {
          writeAtomic(path.join(folder, ".gitignore"), git.DEFAULT_IGNORE);
        }
        await git.commit(folder, "Create workspace");
      }
    } else if (useGit) {
      gitNote =
        "git is not installed: this workspace is not under version control yet";
    }
    return { ...entry, gitNote };
  }

  touch(id) {
    this.registry.update(id, { lastOpened: Date.now() });
  }

  forget(id) {
    this.registry.remove(id);
  }

  /** every scene file, any depth, newest first */
  scenes(id) {
    const root = this.root(id);
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || SKIP.has(entry.name)) {
          continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && isSceneName(entry.name)) {
          const st = fs.statSync(full);
          out.push({
            path: toRel(root, full),
            name: entry.name,
            mtime: st.mtimeMs,
            size: st.size,
          });
        }
      }
    };
    walk(root);
    return out.sort((a, b) => b.mtime - a.mtime);
  }

  readScene(id, rel) {
    const full = resolveInside(this.root(id), rel);
    if (!isSceneName(full)) {
      throw new Error("not a scene file");
    }
    return fs.readFileSync(full, "utf8");
  }

  /** @returns {{ path: string, bytes: number }} */
  writeScene(id, rel, text) {
    const full = resolveInside(this.root(id), rel);
    if (!isSceneName(full)) {
      throw new Error("not a scene file");
    }
    if (typeof text !== "string") {
      throw new Error("scene must be text");
    }
    // a file that is not JSON is never written over a good one
    JSON.parse(text);
    writeAtomic(full, text);
    return { path: toRel(this.root(id), full), bytes: Buffer.byteLength(text) };
  }

  /** a new empty scene named after `name`, next to the others (or in `dir`) */
  newScene(id, name, dir = "") {
    const root = this.root(id);
    const base =
      slug(String(name ?? "").replace(/\.excalidraw$/i, "")) || "scene";
    const folder = dir ? resolveInside(root, dir) : root;
    let n = 1;
    let file = path.join(folder, `${base}${SCENE_EXT}`);
    while (fs.existsSync(file)) {
      n++;
      file = path.join(folder, `${base}-${n}${SCENE_EXT}`);
    }
    writeAtomic(file, emptyScene());
    return toRel(root, file);
  }

  /** a new scene file holding `text`, named after `name`, next to the others */
  saveNewScene(id, name, text, dir = "") {
    // checked first, so a bad text leaves no empty file behind
    JSON.parse(text);
    const rel = this.newScene(id, name, dir);
    this.writeScene(id, rel, text);
    return rel;
  }

  settings(id) {
    return this.registry.get(id)?.settings ?? {};
  }

  setSettings(id, patch) {
    return this.registry.update(id, { settings: patch });
  }
}

module.exports = { Workspaces, writeAtomic, META };
