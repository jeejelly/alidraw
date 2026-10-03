const { handle } = require("./handle");

const registerBackupHandlers = ({ workspaces, secrets, backup }) => {
  handle("ws:secretsStatus", () => secrets.status());
  handle("ws:secretsUnlock", ({ passphrase, keychain }) => {
    if (secrets.status().exists) {
      secrets.unlock(passphrase);
    } else if (keychain === true) {
      secrets.createWithKeychain();
    } else {
      secrets.create(passphrase);
    }
    // what was waiting for the passwords can go now
    for (const workspace of workspaces.list()) {
      backup.queue(workspace.id);
    }
    return secrets.status();
  });
  handle("ws:secretsLock", () => {
    secrets.lock();
    return secrets.status();
  });
  handle("ws:serverGet", ({ id }) => backup.publicConfig(id));
  handle("ws:serverSet", ({ id, server, password }) =>
    backup.setConfig(id, server, password),
  );
  handle("ws:serverTrust", ({ id, fingerprint }) =>
    backup.trustHostKey(id, fingerprint),
  );
  handle("ws:serverTest", ({ id }) => backup.test(id));
  handle("ws:backupNow", ({ id }) => backup.backupNow(id));
  handle("ws:fetchAll", ({ id }) => backup.fetchAll(id));
  handle("ws:keepOut", ({ id, on }) => backup.setKeepOut(id, on === true));
};

module.exports = { registerBackupHandlers };
