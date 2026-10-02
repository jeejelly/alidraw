const { execFile } = require("node:child_process");

/**
 * The machine's own git, run without a shell. Prompts are off (credentials
 * come from git's helpers or the ssh agent) and local-command transports are
 * refused, so a remote URL cannot run anything on this machine.
 */
const SAFE = [
  "-c",
  "protocol.ext.allow=never",
  "-c",
  "protocol.file.allow=user",
  "-c",
  "core.quotepath=off",
];

const run = (cwd, args, { input, timeout = 60000 } = {}) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      "git",
      [...SAFE, ...args],
      {
        cwd,
        timeout,
        maxBuffer: 64 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_ASKPASS: "echo",
          LC_ALL: "C",
          GIT_OPTIONAL_LOCKS: "0",
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          const e = new Error((stderr || error.message).trim());
          e.code = error.code;
          e.stderr = stderr;
          reject(e);
        } else {
          resolve(stdout);
        }
      },
    );
    if (input !== undefined) {
      child.stdin.end(input);
    }
  });

/** the git version string, or null when git is not installed */
const version = async () => {
  try {
    return (await run(process.cwd(), ["--version"])).trim();
  } catch {
    return null;
  }
};

const isRepo = async (root) => {
  try {
    return (
      (await run(root, ["rev-parse", "--is-inside-work-tree"])).trim() ===
      "true"
    );
  } catch {
    return false;
  }
};

const DEFAULT_IGNORE = [
  "# local files",
  ".DS_Store",
  "*.tmp",
  ".excalidraw-local/",
  "",
].join("\n");

const init = async (root, branch = "main") => {
  try {
    await run(root, ["init", "-b", branch]);
  } catch {
    // git before 2.28 has no -b
    await run(root, ["init"]);
    await run(root, ["symbolic-ref", "HEAD", `refs/heads/${branch}`]);
  }
  await ensureIdentity(root);
};

/** commits need an identity; a neutral local one is set only when none is configured */
const ensureIdentity = async (root) => {
  for (const [key, value] of [
    ["user.name", "Excalidraw workspace"],
    ["user.email", "workspace@localhost"],
  ]) {
    let have = "";
    try {
      have = (await run(root, ["config", key])).trim();
    } catch {
      // not set
    }
    if (!have) {
      await run(root, ["config", "--local", key, value]);
    }
  }
};

/**
 * Where the folder sits in its repository ("" at the top, "designs/" inside one that
 * holds more than this project). Everything shown or committed stays inside the folder.
 */
const prefixOf = async (root) =>
  (await run(root, ["rev-parse", "--show-prefix"])).trim();

/** @returns {{branch, upstream, ahead, behind, changes: {path, code}[], clean: boolean}} */
const status = async (root) => {
  const prefix = await prefixOf(root);
  const out = await run(root, [
    "status",
    "--porcelain=v2",
    "--branch",
    "-z",
    "--",
    ".",
  ]);
  const inside = (p) =>
    prefix && p.startsWith(prefix) ? p.slice(prefix.length) : p;
  const result = {
    branch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    changes: [],
    clean: true,
  };
  const parts = out.split("\0");
  for (let i = 0; i < parts.length; i++) {
    const line = parts[i];
    if (!line) {
      continue;
    }
    if (line.startsWith("# branch.head ")) {
      result.branch = line.slice(14);
    } else if (line.startsWith("# branch.upstream ")) {
      result.upstream = line.slice(18);
    } else if (line.startsWith("# branch.ab ")) {
      const m = /\+(\d+) -(\d+)/.exec(line);
      if (m) {
        result.ahead = +m[1];
        result.behind = +m[2];
      }
    } else if (line[0] === "1") {
      const f = line.split(" ");
      result.changes.push({ path: inside(f.slice(8).join(" ")), code: f[1] });
    } else if (line[0] === "2") {
      const f = line.split(" ");
      result.changes.push({ path: inside(f.slice(9).join(" ")), code: f[1] });
      i++; // the original path follows
    } else if (line[0] === "?") {
      result.changes.push({ path: inside(line.slice(2)), code: "??" });
    }
  }
  result.clean = result.changes.length === 0;
  return result;
};

/**
 * Commits the given paths (everything when omitted). Returns the new commit's
 * short hash, or null when there was nothing to commit.
 */
const commit = async (root, message, paths) => {
  await run(root, [
    "add",
    "-A",
    "--",
    ...(paths && paths.length ? paths : ["."]),
  ]);
  try {
    await run(root, ["diff", "--cached", "--quiet", "--", "."]);
    return null; // nothing staged
  } catch (e) {
    if (e.code !== 1) {
      throw e;
    }
  }
  await run(root, ["commit", "-m", message, "--", "."]);
  return (await run(root, ["rev-parse", "--short", "HEAD"])).trim();
};

/** the history of one file (or the whole repository) */
const log = async (root, relPath, limit = 50) => {
  let out;
  try {
    out = await run(root, [
      "log",
      `-n${limit}`,
      "--format=%H%x1f%h%x1f%aI%x1f%s%x1e",
      ...(relPath ? ["--", relPath] : []),
    ]);
  } catch (e) {
    if (/does not have any commits|unknown revision/.test(e.message)) {
      return [];
    }
    throw e;
  }
  return out
    .split("\x1e")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [hash, short, date, subject] = r.split("\x1f");
      return { hash, short, date, subject };
    });
};

/** the content of a file as of a commit */
const showFile = (root, hash, relPath) => {
  if (!/^[0-9a-f]{7,40}$/i.test(hash)) {
    throw new Error("invalid commit");
  }
  // relative to the folder, which may sit inside a bigger repository
  return run(root, ["show", `${hash}:./${relPath}`]);
};

/** a remote URL the app will accept: https, ssh, scp-like, file or an absolute path */
const checkRemoteUrl = (url) => {
  const u = String(url ?? "").trim();
  if (
    !u ||
    u.startsWith("-") ||
    /[\s\u0000-\u001f]/.test(u) ||
    u.includes("::")
  ) {
    throw new Error("that is not a valid remote address");
  }
  const ok =
    /^https:\/\/[^/]+\/.+/.test(u) ||
    /^ssh:\/\/[^/]+\/.+/.test(u) ||
    /^[\w.-]+@[\w.-]+:[^\s]+$/.test(u) ||
    /^file:\/\/\/.+/.test(u) ||
    /^\/[^\s]*$/.test(u) ||
    /^[A-Za-z]:[\\/][^\s]*$/.test(u);
  if (!ok) {
    throw new Error(
      "use an https:// or ssh:// address, user@host:path, or a folder path",
    );
  }
  return u;
};

/** @returns {{name, url}[]} fetch urls */
const remotes = async (root) => {
  const out = await run(root, ["remote", "-v"]);
  const seen = new Map();
  for (const line of out.split("\n")) {
    const m = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line.trim());
    if (m && !seen.has(m[1])) {
      seen.set(m[1], m[2]);
    }
  }
  return [...seen].map(([name, url]) => ({ name, url }));
};

const setRemote = async (root, url, name = "origin") => {
  const checked = checkRemoteUrl(url);
  const have = (await remotes(root)).some((r) => r.name === name);
  await run(root, ["remote", have ? "set-url" : "add", name, checked]);
  return checked;
};

const fetchRemote = (root, name = "origin") =>
  run(root, ["fetch", "--prune", name], { timeout: 180000 });

const head = async (root) => (await run(root, ["rev-parse", "HEAD"])).trim();

/** fast-forward only: never makes a merge commit, never discards anything */
const mergeFastForward = (root) => run(root, ["merge", "--ff-only", "@{u}"]);

/** push the current branch; never forced */
const pushCurrent = (root, name = "origin") =>
  run(root, ["push", "-u", name, "HEAD"], { timeout: 180000 });

/** merge the upstream in; on conflict, undo it completely and say which files clash */
const mergeUpstream = async (root) => {
  try {
    await run(root, ["merge", "--no-edit", "@{u}"]);
    return { merged: true, conflicts: [] };
  } catch (error) {
    let conflicts = [];
    try {
      conflicts = (await run(root, ["diff", "--name-only", "--diff-filter=U"]))
        .split("\n")
        .filter(Boolean);
    } catch {
      // not in a merge
    }
    try {
      await run(root, ["merge", "--abort"]);
    } catch {
      // nothing to abort
    }
    return { merged: false, conflicts, message: error.message };
  }
};

/** a new local branch at the current commit, pushed with its own upstream */
const branchOff = async (root, branch, name = "origin") => {
  if (!/^[A-Za-z0-9._\/-]{1,80}$/.test(branch) || branch.startsWith("-")) {
    throw new Error("invalid branch name");
  }
  await run(root, ["switch", "-c", branch]);
  await run(root, ["push", "-u", name, branch], { timeout: 180000 });
  return branch;
};

/** files that differ between two commits */
const changedBetween = async (root, a, b) =>
  (await run(root, ["diff", "--relative", "--name-only", a, b]))
    .split("\n")
    .filter(Boolean);

module.exports = {
  prefixOf,
  ensureIdentity,
  checkRemoteUrl,
  remotes,
  setRemote,
  fetchRemote,
  head,
  mergeFastForward,
  pushCurrent,
  mergeUpstream,
  branchOff,
  changedBetween,
  run,
  version,
  isRepo,
  init,
  status,
  commit,
  log,
  showFile,
  DEFAULT_IGNORE,
};
