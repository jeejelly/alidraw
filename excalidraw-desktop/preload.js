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
    onEvent: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("ws:event", listener);
      return () => ipcRenderer.removeListener("ws:event", listener);
    },
  },
});
