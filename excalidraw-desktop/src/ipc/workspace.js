const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const { BrowserWindow, dialog } = require("electron");

const { MIN_SYNC_SECONDS, MAX_SYNC_SECONDS } = require("../services");

const { handle } = require("./handle");

const MAX_PICKED_BYTES = 200 * 1024 * 1024;

// folders the user picked in a dialog; the page names them by token, never by path
const pickedFolders = new Map();

const takeFolder = (token) => {
  const folder = pickedFolders.get(token);
  if (!folder) {
    throw new Error("choose a folder first");
  }
  pickedFolders.delete(token);
  return folder;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Only known keys with valid values get through. */
const sanitizeSettings = (settings) => {
  const allowed = {};
  if (typeof settings?.autoCommit === "boolean") {
    allowed.autoCommit = settings.autoCommit;
  }
  if (["manual", "afterCommit", "interval"].includes(settings?.push)) {
    allowed.push = settings.push;
  }
  if (Number.isFinite(settings?.syncEverySec)) {
    allowed.syncEverySec = clamp(
      Math.round(settings.syncEverySec),
      MIN_SYNC_SECONDS,
      MAX_SYNC_SECONDS,
    );
  }
  if (typeof settings?.pullOnOpen === "boolean") {
    allowed.pullOnOpen = settings.pullOnOpen;
  }
  if (Number.isFinite(settings?.delaySec)) {
    allowed.delaySec = clamp(Math.round(settings.delaySec), 5, 3600);
  }
  return allowed;
};

const readPickedFiles = (filePaths) => {
  let total = 0;
  return filePaths.map((file) => {
    const bytes = fs.readFileSync(file);
    total += bytes.length;
    if (total > MAX_PICKED_BYTES) {
      throw new Error("those files are too large to open together");
    }
    return { name: path.basename(file), base64: bytes.toString("base64") };
  });
};

const registerFolderHandlers = ({ workspaces }) => {
  handle("ws:pickFolder", async (_args, event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (canceled || !filePaths[0]) {
      return null;
    }
    const token = randomUUID();
    pickedFolders.set(token, filePaths[0]);
    return { token, display: filePaths[0] };
  });
  handle("ws:list", () => workspaces.list());
  handle("ws:create", ({ name, useGit, token }) =>
    workspaces.create({
      name,
      useGit: useGit !== false,
      parent: takeFolder(token),
    }),
  );
  handle("ws:open", ({ token, useGit }) =>
    workspaces.open(takeFolder(token), { useGit: useGit !== false }),
  );
  handle("ws:forget", ({ id }) => workspaces.forget(id));
};

const registerSceneHandlers = ({ workspaces, autoCommit }) => {
  const touch = (id, relativePath) =>
    autoCommit.touch(id, workspaces.root(id), relativePath);

  handle("ws:saveNew", ({ id, name, text, dir }) => {
    const relativePath = workspaces.saveNewScene(id, name, text, dir);
    touch(id, relativePath);
    return { path: relativePath };
  });
  handle("ws:scenes", ({ id }) => {
    workspaces.touch(id);
    return workspaces.scenes(id);
  });
  handle("ws:read", ({ id, path: relativePath }) =>
    workspaces.readScene(id, relativePath),
  );
  handle("ws:write", ({ id, path: relativePath, text }) => {
    const result = workspaces.writeScene(id, relativePath, text);
    touch(id, result.path);
    return result;
  });
  handle("ws:newScene", ({ id, name, dir }) =>
    workspaces.newScene(id, name, dir),
  );
  handle("ws:renameScene", ({ id, path: relativePath, name }) => {
    const next = workspaces.renameScene(id, relativePath, name);
    // the old name is a deletion and the new one an addition: both are committed
    touch(id, relativePath);
    touch(id, next);
    return next;
  });
  handle("ws:duplicateScene", ({ id, path: relativePath }) => {
    const next = workspaces.duplicateScene(id, relativePath);
    touch(id, next);
    return next;
  });
  handle("ws:deleteScene", ({ id, path: relativePath }) => {
    workspaces.deleteScene(id, relativePath);
    touch(id, relativePath);
  });
};

const registerAssetHandlers = ({ workspaces, autoCommit, backup }) => {
  const touch = (id, relativePath) =>
    autoCommit.touch(id, workspaces.root(id), relativePath);

  handle("ws:assets", ({ id }) => workspaces.listAssets(id));
  handle("ws:readAsset", async ({ id, path: relativePath }) => {
    try {
      return workspaces.readAsset(id, relativePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      // not on this machine yet: the work server has it
      await backup.fetch(id, relativePath);
      return workspaces.readAsset(id, relativePath);
    }
  });
  handle("ws:writeAsset", ({ id, mime, base64 }) => {
    const result = workspaces.writeAsset(id, mime, base64);
    // the file is committed with the scenes that refer to it, unless binaries live on the server
    if (workspaces.meta(id).binaries !== "server") {
      touch(id, result.path);
    }
    backup.queue(id);
    return result;
  });
  handle("ws:writeExport", ({ id, name, base64 }) => {
    const result = workspaces.writeExport(id, name, base64);
    touch(id, result.path);
    backup.queue(id);
    return result;
  });
  // the files to read (images, scenes) are picked starting in the workspace; the page gets
  // their bytes, never their paths
  handle("ws:pickFiles", async ({ id, extensions, multiple }, event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const validExtensions = (Array.isArray(extensions) ? extensions : [])
      .map((extension) => String(extension).replace(/^\./, ""))
      .filter((extension) => /^[A-Za-z0-9]{1,8}$/.test(extension));
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      defaultPath: workspaces.root(id),
      properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
      filters: validExtensions.length
        ? [{ name: "Files", extensions: validExtensions }]
        : undefined,
    });
    if (canceled || !filePaths.length) {
      return null;
    }
    return readPickedFiles(filePaths);
  });
};

const registerSettingsHandlers = ({ workspaces, schedule }) => {
  handle("ws:meta", ({ id }) => workspaces.meta(id));
  handle("ws:setMeta", ({ id, meta }) => {
    const allowed = {};
    if (meta?.assets === "embedded" || meta?.assets === "linked") {
      allowed.assets = meta.assets;
    }
    return workspaces.setMeta(id, allowed);
  });
  handle("ws:getSettings", ({ id }) => workspaces.settings(id));
  handle("ws:setSettings", ({ id, settings }) => {
    const entry = workspaces.setSettings(id, sanitizeSettings(settings));
    schedule(id);
    return entry;
  });
};

const registerWorkspaceHandlers = (services) => {
  registerFolderHandlers(services);
  registerSceneHandlers(services);
  registerAssetHandlers(services);
  registerSettingsHandlers(services);
};

module.exports = { registerWorkspaceHandlers };
