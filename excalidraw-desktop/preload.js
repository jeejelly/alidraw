// The page's only door to the machine: a narrow, named set of workspace calls. Everything
// is checked again in the main process.
const { contextBridge, ipcRenderer } = require("electron");

const call = async (channel, payload) => {
  const reply = await ipcRenderer.invoke(channel, payload);
  if (!reply.ok) {
    throw new Error(reply.error);
  }
  return reply.value;
};

contextBridge.exposeInMainWorld("excalidrawDesktop", {
  version: 1,
  exportPdf: (args) => call("pdf:export", args),
  workspace: {
    gitInfo: () => call("ws:gitInfo"),
    installGit: () => call("ws:installGit"),
    pickFolder: () => call("ws:pickFolder"),
    list: () => call("ws:list"),
    create: (args) => call("ws:create", args),
    open: (args) => call("ws:open", args),
    saveNew: (id, name, text, dir) =>
      call("ws:saveNew", { id, name, text, dir }),
    forget: (id) => call("ws:forget", { id }),
    scenes: (id) => call("ws:scenes", { id }),
    read: (id, path) => call("ws:read", { id, path }),
    write: (id, path, text) => call("ws:write", { id, path, text }),
    newScene: (id, name, dir) => call("ws:newScene", { id, name, dir }),
    writeAsset: (id, mime, base64) =>
      call("ws:writeAsset", { id, mime, base64 }),
    renameScene: (id, path, name) => call("ws:renameScene", { id, path, name }),
    duplicateScene: (id, path) => call("ws:duplicateScene", { id, path }),
    deleteScene: (id, path) => call("ws:deleteScene", { id, path }),
    assets: (id) => call("ws:assets", { id }),
    readAsset: (id, path) => call("ws:readAsset", { id, path }),
    meta: (id) => call("ws:meta", { id }),
    setMeta: (id, meta) => call("ws:setMeta", { id, meta }),
    getSettings: (id) => call("ws:getSettings", { id }),
    setSettings: (id, settings) => call("ws:setSettings", { id, settings }),
    status: (id) => call("ws:status", { id }),
    remoteSet: (id, url) => call("ws:remoteSet", { id, url }),
    sync: (id, options) => call("ws:sync", { id, ...options }),
    resolve: (id, choice) => call("ws:resolve", { id, choice }),
    setPaused: (paused) => call("ws:setPaused", { paused }),
    activate: (id) => call("ws:activate", { id }),
    commitNow: (id, message) => call("ws:commitNow", { id, message }),
    history: (id, path) => call("ws:history", { id, path }),
    showVersion: (id, hash, path) => call("ws:showVersion", { id, hash, path }),
    secretsStatus: () => call("ws:secretsStatus"),
    secretsUnlock: (passphrase, keychain) =>
      call("ws:secretsUnlock", { passphrase, keychain }),
    secretsLock: () => call("ws:secretsLock"),
    serverGet: (id) => call("ws:serverGet", { id }),
    serverSet: (id, server, password) =>
      call("ws:serverSet", { id, server, password }),
    serverTrust: (id, fingerprint) =>
      call("ws:serverTrust", { id, fingerprint }),
    serverTest: (id) => call("ws:serverTest", { id }),
    backupNow: (id) => call("ws:backupNow", { id }),
    fetchAll: (id) => call("ws:fetchAll", { id }),
    keepOut: (id, on) => call("ws:keepOut", { id, on }),
    onEvent: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("ws:event", listener);
      return () => ipcRenderer.removeListener("ws:event", listener);
    },
  },
});
