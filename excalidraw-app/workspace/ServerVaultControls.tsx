import type { VaultStatus } from "./desktopBridge";

const stopKeys = (event: React.KeyboardEvent) => event.stopPropagation();

export const ServerVaultControls = ({
  vault,
  passphrase,
  busy,
  onPassphraseChange,
  onUnlock,
  onLock,
  onUseKeychain,
}: {
  vault: VaultStatus;
  passphrase: string;
  busy: boolean;
  onPassphraseChange: (passphrase: string) => void;
  onUnlock: () => void;
  onLock: () => void;
  onUseKeychain: () => void;
}) => (
  <div className="workspace__setting" data-testid="server-vault">
    {vault.unlocked ? (
      <>
        Passwords unlocked
        {vault.mode === "keychain" ? " (OS keychain)" : ""}.
        <button type="button" onClick={onLock}>
          Lock
        </button>
      </>
    ) : (
      <>
        <input
          type="password"
          data-testid="server-passphrase"
          placeholder={
            vault.exists ? "Passphrase" : "Choose a passphrase (8+ characters)"
          }
          value={passphrase}
          onChange={(event) => onPassphraseChange(event.target.value)}
          onKeyDown={stopKeys}
        />
        <button
          type="button"
          data-testid="server-unlock"
          disabled={!passphrase || busy}
          onClick={onUnlock}
        >
          {vault.exists ? "Unlock" : "Create"}
        </button>
        {!vault.exists && vault.keychainAvailable && (
          <button
            type="button"
            data-testid="server-keychain"
            disabled={busy}
            onClick={onUseKeychain}
          >
            Use the OS keychain instead
          </button>
        )}
      </>
    )}
  </div>
);
