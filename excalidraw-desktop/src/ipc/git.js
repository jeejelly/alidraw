const fs = require("node:fs");
const { execFile } = require("node:child_process");

const { BrowserWindow, dialog } = require("electron");

const git = require("../git");
const { resolveInside } = require("../paths");

const { handle } = require("./handle");

const GIT_HELP = {
  linux:
    "Install git with your package manager, for example: sudo apt install git",
  darwin: "Install git with: xcode-select --install",
  win32: "Install git from https://git-scm.com/download/win",
};

const installHelp = () => GIT_HELP[process.platform] ?? GIT_HELP.linux;

const canInstallGit = () =>
  process.platform === "linux" &&
  fs.existsSync("/usr/bin/apt-get") &&
  fs.existsSync("/usr/bin/pkexec");

const installWithPkexec = () =>
  new Promise((resolve, reject) =>
    execFile(
      "pkexec",
      ["apt-get", "install", "-y", "git"],
      { timeout: 600000 },
      (error) => (error ? reject(error) : resolve()),
    ),
  );

const installGit = async (_args, event) => {
  if (await git.version()) {
    return { installed: true };
  }
  if (!canInstallGit()) {
    return { installed: false, help: installHelp() };
  }
  const window = BrowserWindow.fromWebContents(event.sender);
  const { response } = await dialog.showMessageBox(window, {
    type: "question",
    buttons: ["Install git", "Cancel"],
    defaultId: 0,
    cancelId: 1,
    message: "Install git?",
    detail:
      "This runs: pkexec apt-get install -y git\nYou will be asked for your password.",
  });
  if (response !== 0) {
    return { installed: false, cancelled: true };
  }
  await installWithPkexec();
  return { installed: !!(await git.version()) };
};

const registerGitHandlers = ({ workspaces, autoCommit, registry, sync }) => {
  handle("ws:gitInfo", async () => {
    const version = await git.version();
    return { installed: !!version, version, help: installHelp() };
  });
  handle("ws:installGit", installGit);

  handle("ws:status", async ({ id }) => {
    const root = workspaces.root(id);
    if (!(await git.version())) {
      return { git: false };
    }
    if (!(await git.isRepo(root))) {
      return { git: true, repo: false };
    }
    return {
      git: true,
      repo: true,
      pending: autoCommit.hasPending(id),
      remote: await sync.remote(id),
      sync: sync.info(id),
      paused: registry.appSettings().paused === true,
      ...(await git.status(root)),
    };
  });
  handle("ws:commitNow", async ({ id, message }) => {
    const root = workspaces.root(id);
    const hash = await autoCommit.flush(
      id,
      root,
      typeof message === "string" && message.trim()
        ? message.trim()
        : "Update workspace",
    );
    return { hash };
  });
  handle("ws:history", ({ id, path: relativePath }) => {
    const root = workspaces.root(id);
    resolveInside(root, relativePath);
    return git.log(root, relativePath);
  });
  handle("ws:showVersion", ({ id, hash, path: relativePath }) => {
    const root = workspaces.root(id);
    resolveInside(root, relativePath);
    return git.showFile(root, hash, relativePath);
  });
};

module.exports = { registerGitHandlers };
