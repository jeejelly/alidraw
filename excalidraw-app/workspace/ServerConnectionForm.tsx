import type { ServerConfig } from "./desktopBridge";
import type { ServerForm } from "./useServerSection";

const stopKeys = (event: React.KeyboardEvent) => event.stopPropagation();

export const ServerConnectionForm = ({
  form,
  password,
  hasPassword,
  onChange,
  onPasswordChange,
}: {
  form: ServerForm;
  password: string;
  hasPassword: boolean;
  onChange: (patch: Partial<ServerForm>) => void;
  onPasswordChange: (password: string) => void;
}) => (
  <>
    <div className="workspace__server">
      <select
        data-testid="server-protocol"
        value={form.protocol}
        onChange={(event) => {
          const protocol = event.target.value as ServerConfig["protocol"];
          onChange({
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
        onChange={(event) => onChange({ host: event.target.value })}
        onKeyDown={stopKeys}
      />
      <input
        type="number"
        aria-label="Port"
        value={form.port}
        onChange={(event) => onChange({ port: +event.target.value })}
        onKeyDown={stopKeys}
      />
      <input
        data-testid="server-user"
        placeholder="User"
        value={form.user}
        onChange={(event) => onChange({ user: event.target.value })}
        onKeyDown={stopKeys}
      />
      <input
        type="password"
        data-testid="server-password"
        placeholder={hasPassword ? "Password (saved)" : "Password"}
        autoComplete="off"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={stopKeys}
      />
      <input
        data-testid="server-dir"
        placeholder="Folder on the server"
        value={form.dir}
        onChange={(event) => onChange({ dir: event.target.value })}
        onKeyDown={stopKeys}
      />
    </div>

    {form.protocol === "ftp" && (
      <label className="workspace__banner" data-testid="server-ftp-warning">
        <input
          type="checkbox"
          checked={form.insecureOk === true}
          onChange={(event) => onChange({ insecureOk: event.target.checked })}
        />{" "}
        Plain FTP sends the password and the images without protection. I
        understand and want to use it anyway.
      </label>
    )}
  </>
);
