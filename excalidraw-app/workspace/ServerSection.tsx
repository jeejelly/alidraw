import { useCallback, useEffect, useState } from "react";

import { Fold } from "./Fold";

import type {
  BackupResult,
  DesktopWorkspaceBridge,
  ServerConfig,
  ServerInfo,
} from "./desktopBridge";

const describe = (r: BackupResult): string => {
  switch (r.outcome) {
    case "done":
      return `Backed up ${r.uploaded} image${r.uploaded === 1 ? "" : "s"}, ${
        r.already
      } already there${r.failed.length ? `, ${r.failed.length} failed` : ""}.`;
    case "fetched":
      return `Fetched ${r.downloaded} image${r.downloaded === 1 ? "" : "s"}${
        r.failed.length ? `, ${r.failed.length} failed` : ""
      }.`;
    case "ok":
      return `Connected. ${r.files} image${
        r.files === 1 ? "" : "s"
      } on the server.`;
    case "paused":
      return "Network is paused.";
    case "no-server":
      return "No server set.";
    case "locked":
      return "Unlock the passwords first.";
    case "no-password":
      return "Enter the server's password.";
    default:
      return r.message;
  }
};

const empty: Omit<ServerConfig, "hostKey"> = {
  protocol: "sftp",
  host: "",
  port: 22,
  user: "",
  dir: "/",
  insecureOk: false,
};

/** the backup / work server of a workspace: where binary images are copied and fetched from */
export const ServerSection = ({
  bridge,
  id,
}: {
  bridge: DesktopWorkspaceBridge;
  id: string;
}) => {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [form, setForm] = useState(empty);
  const [password, setPassword] = useState("");
  const [vault, setVault] = useState({ exists: false, unlocked: false });
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [unknownKey, setUnknownKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [i, v] = await Promise.all([
      bridge.serverGet(id),
      bridge.secretsStatus(),
    ]);
    setInfo(i);
    setVault(v);
    setForm(i.server ? { ...empty, ...i.server } : empty);
  }, [bridge, id]);

  useEffect(() => {
    load().catch((e) => setMessage(e.message));
    return bridge.onEvent((e) => {
      if (e.type === "backup" && e.id === id) {
        setMessage(describe(e));
        bridge.serverGet(id).then(setInfo, () => {});
      }
    });
  }, [bridge, id, load]);

  const run = async (fn: () => Promise<BackupResult | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fn();
      if (r) {
        setMessage(describe(r));
        setUnknownKey(
          r.outcome === "error" && r.code === "HOSTKEY_UNKNOWN"
            ? r.fingerprint
            : null,
        );
      }
    } catch (e: any) {
      setMessage(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  const unlock = () =>
    run(async () => {
      setVault(await bridge.secretsUnlock(passphrase));
      setPassphrase("");
    });

  const save = () =>
    run(async () => {
      setInfo(await bridge.serverSet(id, form, password || undefined));
      setPassword("");
      setMessage("Server saved.");
    });

  const stop = (e: React.KeyboardEvent) => e.stopPropagation();

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

      <div className="workspace__setting" data-testid="server-vault">
        {vault.unlocked ? (
          <>
            Passwords unlocked.
            <button
              type="button"
              onClick={() =>
                run(async () => setVault(await bridge.secretsLock()))
              }
            >
              Lock
            </button>
          </>
        ) : (
          <>
            <input
              type="password"
              data-testid="server-passphrase"
              placeholder={
                vault.exists
                  ? "Passphrase"
                  : "Choose a passphrase (8+ characters)"
              }
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={stop}
            />
            <button
              type="button"
              data-testid="server-unlock"
              disabled={!passphrase || busy}
              onClick={unlock}
            >
              {vault.exists ? "Unlock" : "Create"}
            </button>
          </>
        )}
      </div>

      <div className="workspace__server">
        <select
          data-testid="server-protocol"
          value={form.protocol}
          onChange={(e) => {
            const protocol = e.target.value as ServerConfig["protocol"];
            set({
              protocol,
              port: protocol === "sftp" ? 22 : 21,
              insecureOk: false,
            });
          }}
        >
          <option value="sftp">SFTP (SSH, recommended)</option>
          <option value="ftps">FTPS (FTP over TLS)</option>
          <option value="ftp">FTP (not protected)</option>
        </select>
        <input
          data-testid="server-host"
          placeholder="Host"
          value={form.host}
          onChange={(e) => set({ host: e.target.value })}
          onKeyDown={stop}
        />
        <input
          type="number"
          aria-label="Port"
          value={form.port}
          onChange={(e) => set({ port: +e.target.value })}
          onKeyDown={stop}
        />
        <input
          data-testid="server-user"
          placeholder="User"
          value={form.user}
          onChange={(e) => set({ user: e.target.value })}
          onKeyDown={stop}
        />
        <input
          type="password"
          data-testid="server-password"
          placeholder={info?.hasPassword ? "Password (saved)" : "Password"}
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={stop}
        />
        <input
          data-testid="server-dir"
          placeholder="Folder on the server"
          value={form.dir}
          onChange={(e) => set({ dir: e.target.value })}
          onKeyDown={stop}
        />
      </div>

      {form.protocol === "ftp" && (
        <label className="workspace__banner" data-testid="server-ftp-warning">
          <input
            type="checkbox"
            checked={form.insecureOk === true}
            onChange={(e) => set({ insecureOk: e.target.checked })}
          />{" "}
          Plain FTP sends the password and the images without protection. I
          understand and want to use it anyway.
        </label>
      )}

      <div className="workspace__git">
        <button
          type="button"
          data-testid="server-save"
          disabled={busy || !form.host.trim() || !form.user.trim()}
          onClick={save}
        >
          Save
        </button>
        <button
          type="button"
          data-testid="server-test"
          disabled={busy || !info?.server}
          onClick={() => run(() => bridge.serverTest(id))}
        >
          Test
        </button>
        <button
          type="button"
          data-testid="server-backup"
          disabled={busy || !info?.server}
          onClick={() => run(() => bridge.backupNow(id))}
        >
          Back up now
        </button>
        <button
          type="button"
          data-testid="server-fetch"
          disabled={busy || !info?.server}
          onClick={() => run(() => bridge.fetchAll(id))}
        >
          Fetch missing
        </button>
        <button
          type="button"
          disabled={busy || !info?.server}
          onClick={() =>
            run(async () => {
              setInfo(await bridge.serverSet(id, null));
              setForm(empty);
            })
          }
        >
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
              onClick={() =>
                run(async () => {
                  setInfo(await bridge.serverTrust(id, unknownKey));
                  setUnknownKey(null);
                  setMessage("Server trusted. Try again.");
                })
              }
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
          disabled={busy || !info?.server}
          checked={info?.keepOut === true}
          onChange={(e) =>
            run(async () => setInfo(await bridge.keepOut(id, e.target.checked)))
          }
        />
        Keep images out of git (only once all are on the server)
      </label>

      {(message || info?.state) && (
        <div className="workspace__hint" data-testid="server-message">
          {message ?? (info?.state ? describe(info.state) : "")}
        </div>
      )}
    </Fold>
  );
};
