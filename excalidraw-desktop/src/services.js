// The workspace services and how they are wired to each other.
const { app, BrowserWindow, safeStorage } = require("electron");

const { AutoCommit } = require("./autocommit");
const { Backup } = require("./backup");
const { Secrets } = require("./secrets");
const { Registry } = require("./registry");
const { Sync } = require("./sync");
const { Workspaces } = require("./workspace");

const MIN_SYNC_SECONDS = 30;
const MAX_SYNC_SECONDS = 86400;
const MIN_COMMIT_DELAY_SECONDS = 5;

const broadcast = (data) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("ws:event", data);
  }
};

const createSecrets = () => {
  const secrets = new Secrets(app.getPath("userData"), {
    // a plain-text fallback store is no protection: treated as unavailable
    available: () =>
      safeStorage.isEncryptionAvailable() &&
      (process.platform !== "linux" ||
        safeStorage.getSelectedStorageBackend?.() !== "basic_text"),
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (buffer) => safeStorage.decryptString(buffer),
  });
  // a keychain-protected manifest opens by itself
  if (secrets.status().mode === "keychain") {
    try {
      secrets.unlock();
    } catch {
      // stays locked; the panel says so
    }
  }
  return secrets;
};

/** Commits what the app saved, and pushes after a commit when the workspace asks for it. */
const createAutoCommit = (workspaces, getSync) =>
  new AutoCommit({
    delayFor: (id) => {
      const settings = workspaces.settings(id);
      return settings.autoCommit
        ? Math.max(MIN_COMMIT_DELAY_SECONDS, settings.delaySec ?? 60) * 1000
        : null;
    },
    onResult: (id, result) => {
      broadcast({ type: "commit", id, ...result });
      if (
        result.ok &&
        result.hash &&
        workspaces.settings(id).push === "afterCommit"
      ) {
        getSync()
          .sync(id)
          .catch(() => {});
      }
    },
  });

/** What is waiting is committed before the app closes. */
const flushOnQuit = (autoCommit) => {
  let closing = false;
  app.on("before-quit", (event) => {
    if (closing) {
      return;
    }
    event.preventDefault();
    closing = true;
    autoCommit.flushAll().finally(() => app.quit());
  });
};

const createServices = () => {
  const registry = new Registry(app.getPath("userData"));
  const workspaces = new Workspaces({ registry });
  const isPaused = () => registry.appSettings().paused === true;
  const services = { registry, workspaces };

  services.autoCommit = createAutoCommit(workspaces, () => services.sync);
  services.secrets = createSecrets();
  services.backup = new Backup({
    workspaces,
    registry,
    secrets: services.secrets,
    isPaused,
    emit: broadcast,
  });
  services.sync = new Sync({
    workspaces,
    isPaused,
    // only what the app itself saved is committed on the way to a push
    flush: (id) =>
      services.autoCommit.hasPending(id) ? services.autoCommit.flush(id) : null,
    emit: broadcast,
  });

  const syncTimers = new Map();
  /** The timer of the "every N seconds" push policy. */
  services.schedule = (id) => {
    clearInterval(syncTimers.get(id));
    syncTimers.delete(id);
    const settings = workspaces.settings(id);
    if (settings.push === "interval") {
      const every =
        Math.min(
          MAX_SYNC_SECONDS,
          Math.max(MIN_SYNC_SECONDS, settings.syncEverySec ?? 300),
        ) * 1000;
      syncTimers.set(
        id,
        setInterval(() => services.sync.sync(id).catch(() => {}), every),
      );
    }
  };
  for (const workspace of workspaces.list()) {
    services.schedule(workspace.id);
  }

  flushOnQuit(services.autoCommit);
  return services;
};

module.exports = { createServices, MIN_SYNC_SECONDS, MAX_SYNC_SECONDS };
