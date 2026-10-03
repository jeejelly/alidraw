const { handle } = require("./handle");

const registerSyncHandlers = ({ workspaces, registry, backup, sync }) => {
  handle("ws:remoteSet", ({ id, url }) => sync.setRemote(id, url));
  handle("ws:sync", ({ id, pull, push }) =>
    sync.sync(id, { pull: pull !== false, push: push !== false }),
  );
  handle("ws:resolve", ({ id, choice }) => sync.resolve(id, choice));
  handle("ws:setPaused", ({ paused }) =>
    registry.setAppSettings({ paused: paused === true }),
  );
  // a workspace became the one in use: pull what others pushed, if asked to
  handle("ws:activate", async ({ id }) => {
    workspaces.touch(id);
    backup.queue(id);
    if (
      workspaces.settings(id).pullOnOpen !== false &&
      (await sync.remote(id))
    ) {
      sync.sync(id, { push: false }).catch(() => {});
    }
  });
};

module.exports = { registerSyncHandlers };
