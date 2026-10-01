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
  // commits need an identity; use a neutral local one only when none is set
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

/** @returns {{branch, upstream, ahead, behind, changes: {path, code}[], clean: boolean}} */
const status = async (root) => {
  const out = await run(root, ["status", "--porcelain=v2", "--branch", "-z"]);
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
      result.changes.push({ path: f.slice(8).join(" "), code: f[1] });
    } else if (line[0] === "2") {
      const f = line.split(" ");
      result.changes.push({ path: f.slice(9).join(" "), code: f[1] });
      i++; // the original path follows
    } else if (line[0] === "?") {
      result.changes.push({ path: line.slice(2), code: "??" });
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
    await run(root, ["diff", "--cached", "--quiet"]);
    return null; // nothing staged
  } catch (e) {
    if (e.code !== 1) {
      throw e;
    }
  }
  await run(root, ["commit", "-m", message]);
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
  return run(root, ["show", `${hash}:${relPath}`]);
};

module.exports = {
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
