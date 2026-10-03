import { describeBackup } from "./describeBackup";
import { Fold } from "./Fold";
import { ServerConnectionForm } from "./ServerConnectionForm";
import { ServerVaultControls } from "./ServerVaultControls";
import { useServerSection } from "./useServerSection";

import type { DesktopWorkspaceBridge } from "./desktopBridge";

/** the backup / work server of a workspace: where binary images are copied and fetched from */
export const ServerSection = ({
  bridge,
  id,
}: {
  bridge: DesktopWorkspaceBridge;
  id: string;
}) => {
  const server = useServerSection(bridge, id);
  const { info, form, busy, unknownKey, message } = server;
  const noServer = busy || !info?.server;

  return (
    <Fold
      id="server"
      title="Backup server"
      badge={info?.server ? info.server.protocol : ""}
      defaultOpen={false}
    >
      <p className="workspace__hint">
        Images kept as linked files are copied here, and fetched from here when
        a machine does not have them. The password is kept ciphered on this
        machine; you give a passphrase once per session.
      </p>

      <ServerVaultControls
        vault={server.vault}
        passphrase={server.passphrase}
        busy={busy}
        onPassphraseChange={server.setPassphrase}
        onUnlock={server.unlock}
        onLock={server.lock}
        onUseKeychain={server.useKeychain}
      />

      <ServerConnectionForm
        form={form}
        password={server.password}
        hasPassword={!!info?.hasPassword}
        onChange={server.patchForm}
        onPasswordChange={server.setPassword}
      />

      <div className="workspace__git">
        <button
          type="button"
          data-testid="server-save"
          disabled={busy || !form.host.trim() || !form.user.trim()}
          onClick={server.save}
        >
          Save
        </button>
        <button
          type="button"
          data-testid="server-test"
          disabled={noServer}
          onClick={server.test}
        >
          Test
        </button>
        <button
          type="button"
          data-testid="server-backup"
          disabled={noServer}
          onClick={server.backUp}
        >
          Back up now
        </button>
        <button
          type="button"
          data-testid="server-fetch"
          disabled={noServer}
          onClick={server.fetchMissing}
        >
          Fetch missing
        </button>
        <button type="button" disabled={noServer} onClick={server.remove}>
          Remove
        </button>
      </div>

      {unknownKey && (
        <div className="workspace__banner" data-testid="server-hostkey">
          This server has not been seen before. Its key is{" "}
          <code>{unknownKey}</code>. Trust it only if it matches what the
          server's owner gave you.
          <div className="workspace__choices">
            <button
              type="button"
              data-testid="server-trust"
              onClick={() => server.trust(unknownKey)}
            >
              Trust this server
            </button>
          </div>
        </div>
      )}

      <label className="workspace__setting">
        <input
          type="checkbox"
          data-testid="server-keepout"
          disabled={noServer}
          checked={info?.keepOut === true}
          onChange={(event) => server.keepOut(event.target.checked)}
        />
        Keep images out of git (only once all are on the server)
      </label>

      {(message || info?.state) && (
        <div className="workspace__hint" data-testid="server-message">
          {message ?? (info?.state ? describeBackup(info.state) : "")}
        </div>
      )}
    </Fold>
  );
};
