import { useCallback, useEffect, useState } from "react";

import { describeBackup } from "./describeBackup";

import type {
  BackupResult,
  DesktopWorkspaceBridge,
  ServerConfig,
  ServerInfo,
  VaultStatus,
} from "./desktopBridge";

export type ServerForm = Omit<ServerConfig, "hostKey">;

const EMPTY_FORM: ServerForm = {
  protocol: "sftp",
  host: "",
  port: 22,
  user: "",
  dir: "/",
  insecureOk: false,
};

/** State and actions of one workspace's backup server and the password vault. */
export const useServerSection = (
  bridge: DesktopWorkspaceBridge,
  id: string,
) => {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [password, setPassword] = useState("");
  const [vault, setVault] = useState<VaultStatus>({
    exists: false,
    unlocked: false,
  });
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [unknownKey, setUnknownKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [serverInfo, vaultStatus] = await Promise.all([
      bridge.serverGet(id),
      bridge.secretsStatus(),
    ]);
    setInfo(serverInfo);
    setVault(vaultStatus);
    setForm(
      serverInfo.server ? { ...EMPTY_FORM, ...serverInfo.server } : EMPTY_FORM,
    );
  }, [bridge, id]);

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    return bridge.onEvent((event) => {
      if (event.type === "backup" && event.id === id) {
        setMessage(describeBackup(event));
        bridge.serverGet(id).then(setInfo, () => {});
      }
    });
  }, [bridge, id, load]);

  const run = async (action: () => Promise<BackupResult | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (result) {
        setMessage(describeBackup(result));
        setUnknownKey(
          result.outcome === "error" && result.code === "HOSTKEY_UNKNOWN"
            ? result.fingerprint
            : null,
        );
      }
    } catch (error: any) {
      setMessage(error.message ?? String(error));
    } finally {
      setBusy(false);
    }
  };

  const patchForm = (patch: Partial<ServerForm>) =>
    setForm((current) => ({ ...current, ...patch }));

  return {
    info,
    form,
    patchForm,
    password,
    setPassword,
    vault,
    passphrase,
    setPassphrase,
    message,
    unknownKey,
    busy,
    unlock: () =>
      run(async () => {
        setVault(await bridge.secretsUnlock(passphrase));
        setPassphrase("");
      }),
    lock: () => run(async () => setVault(await bridge.secretsLock())),
    useKeychain: () =>
      run(async () => setVault(await bridge.secretsUnlock(undefined, true))),
    save: () =>
      run(async () => {
        setInfo(await bridge.serverSet(id, form, password || undefined));
        setPassword("");
        setMessage("Server saved.");
      }),
    test: () => run(() => bridge.serverTest(id)),
    backUp: () => run(() => bridge.backupNow(id)),
    fetchMissing: () => run(() => bridge.fetchAll(id)),
    remove: () =>
      run(async () => {
        setInfo(await bridge.serverSet(id, null));
        setForm(EMPTY_FORM);
      }),
    trust: (fingerprint: string) =>
      run(async () => {
        setInfo(await bridge.serverTrust(id, fingerprint));
        setUnknownKey(null);
        setMessage("Server trusted. Try again.");
      }),
    keepOut: (keep: boolean) =>
      run(async () => setInfo(await bridge.keepOut(id, keep))),
  };
};
