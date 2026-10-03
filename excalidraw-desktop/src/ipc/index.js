const { registerBackupHandlers } = require("./backup");
const { registerGitHandlers } = require("./git");
const { registerPdfHandlers } = require("./pdf");
const { registerSyncHandlers } = require("./sync");
const { registerWorkspaceHandlers } = require("./workspace");

const registerIpcHandlers = (services) => {
  registerWorkspaceHandlers(services);
  registerGitHandlers(services);
  registerSyncHandlers(services);
  registerBackupHandlers(services);
  registerPdfHandlers(services);
};

module.exports = { registerIpcHandlers };
