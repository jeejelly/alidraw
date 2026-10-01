const path = require("node:path");

/** `name` as a safe folder name: letters, digits, dash, underscore, dot */
const slug = (name) =>
  String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60) || "workspace";

/**
 * `rel` resolved inside `root`; throws when it would leave it (.., absolute
 * paths, drive letters) or touches the repository's own data.
 */
const resolveInside = (root, rel) => {
  if (typeof rel !== "string" || !rel || rel.includes("\0")) {
    throw new Error("invalid path");
  }
  if (path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) {
    throw new Error("path must be relative to the workspace");
  }
  const base = path.resolve(root);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error("path leaves the workspace");
  }
  const first = path.relative(base, full).split(path.sep)[0];
  if (first === ".git") {
    throw new Error("the repository's own folder is off limits");
  }
  return full;
};

const SCENE_EXT = ".excalidraw";

const isSceneName = (name) => name.toLowerCase().endsWith(SCENE_EXT);

/** forward-slash relative path, the form the page and git both use */
const toRel = (root, full) =>
  path.relative(path.resolve(root), full).split(path.sep).join("/");

module.exports = { slug, resolveInside, isSceneName, toRel, SCENE_EXT };
