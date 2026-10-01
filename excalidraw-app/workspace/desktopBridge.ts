/** What the desktop app's preload script offers the page (absent in a browser). */
export type WorkspaceEntry = {
  id: string;
  name: string;
  path: string;
  lastOpened?: number;
  exists?: boolean;
  settings: {
    autoCommit?: boolean;
    delaySec?: number;
    push?: "manual" | "afterCommit" | "interval";
    syncEverySec?: number;
    pullOnOpen?: boolean;
  };
  gitNote?: string | null;
};

export type SceneEntry = {
  path: string;
  name: string;
  mtime: number;
  size: number;
};

export type SyncInfo = {
  state:
    | "idle"
    | "syncing"
    | "ahead"
    | "behind"
    | "diverged"
    | "error"
    | "paused"
    | "no-remote";
  message: string | null;
  at?: string;
  files?: string[];
};

export type SyncOutcome =
  | { outcome: "in-sync" | "pushed" | "diverged" | "no-remote" | "paused" }
  | { outcome: "pulled"; files: string[] }
  | { outcome: "blocked"; message?: string };

export type ResolveOutcome =
  | { outcome: "merged"; files: string[] }
  | { outcome: "conflict"; conflicts: string[] }
  | { outcome: "branched"; branch: string };

export type GitStatus =
  | { git: false }
  | { git: true; repo: false }
  | {
      git: true;
      repo: true;
      pending: boolean;
      remote: { name: string; url: string } | null;
      sync: SyncInfo;
      paused: boolean;
      branch: string | null;
      upstream: string | null;
      ahead: number;
      behind: number;
      changes: { path: string; code: string }[];
      clean: boolean;
    };

export type Commit = {
  hash: string;
  short: string;
  date: string;
  subject: string;
};

export type VaultStatus = {
  exists: boolean;
  unlocked: boolean;
  mode?: "passphrase" | "keychain" | null;
  keychainAvailable?: boolean;
};

export type ServerConfig = {
  protocol: "sftp" | "ftps" | "ftp";
  host: string;
  port: number;
  user: string;
  dir: string;
  insecureOk?: boolean;
  hostKey?: string;
};

export type BackupResult =
  | {
      outcome: "done";
      uploaded: number;
      already: number;
      failed: { name: string; message: string }[];
    }
  | {
      outcome: "fetched";
      downloaded: number;
      failed: { name: string; message: string }[];
    }
  | { outcome: "ok"; files: number }
  | { outcome: "paused" | "no-server" | "locked" | "no-password" }
  | {
      outcome: "error";
      message: string;
      code: string | null;
      fingerprint: string | null;
    };

export type ServerInfo = {
  server: ServerConfig | null;
  hasPassword: boolean;
  keepOut: boolean;
  state: (BackupResult & { at: number }) | null;
};

export type WorkspaceEvent =
  | ({ type: "backup"; id: string } & BackupResult)
  | ({ type: "sync"; id: string } & SyncInfo)
  | { type: "pulled"; id: string; files: string[] }
  | { type: "commit"; id: string; ok: true; hash: string | null }
  | { type: "commit"; id: string; ok: false; error: string };

export type DesktopWorkspaceBridge = {
  gitInfo(): Promise<{
    installed: boolean;
    version: string | null;
    help: string;
  }>;
  installGit(): Promise<{
    installed: boolean;
    cancelled?: boolean;
    help?: string;
  }>;
  pickFolder(): Promise<{ token: string; display: string } | null>;
  list(): Promise<WorkspaceEntry[]>;
  create(args: {
    name: string;
    useGit?: boolean;
    token: string;
  }): Promise<WorkspaceEntry>;
  open(args: { token: string; useGit?: boolean }): Promise<WorkspaceEntry>;
  saveNew(
    id: string,
    name: string,
    text: string,
    dir?: string,
  ): Promise<{ path: string }>;
  forget(id: string): Promise<void>;
  scenes(id: string): Promise<SceneEntry[]>;
  read(id: string, path: string): Promise<string>;
  write(
    id: string,
    path: string,
    text: string,
  ): Promise<{ path: string; bytes: number }>;
  newScene(id: string, name: string, dir?: string): Promise<string>;
  writeAsset(
    id: string,
    mime: string,
    base64: string,
  ): Promise<{ path: string; bytes: number }>;
  readAsset(id: string, path: string): Promise<string>;
  meta(id: string): Promise<{ name?: string; assets?: "embedded" | "linked" }>;
  setMeta(
    id: string,
    meta: { assets?: "embedded" | "linked" },
  ): Promise<unknown>;
  getSettings(id: string): Promise<WorkspaceEntry["settings"]>;
  setSettings(
    id: string,
    settings: WorkspaceEntry["settings"],
  ): Promise<WorkspaceEntry>;
  status(id: string): Promise<GitStatus>;
  remoteSet(id: string, url: string): Promise<{ name: string; url: string }>;
  sync(
    id: string,
    options?: { pull?: boolean; push?: boolean },
  ): Promise<SyncOutcome>;
  resolve(id: string, choice: "merge" | "branch"): Promise<ResolveOutcome>;
  setPaused(paused: boolean): Promise<{ paused?: boolean }>;
  activate(id: string): Promise<void>;
  commitNow(id: string, message?: string): Promise<{ hash: string | null }>;
  history(id: string, path: string): Promise<Commit[]>;
  showVersion(id: string, hash: string, path: string): Promise<string>;
  secretsStatus(): Promise<VaultStatus>;
  secretsUnlock(passphrase?: string, keychain?: boolean): Promise<VaultStatus>;
  secretsLock(): Promise<VaultStatus>;
  serverGet(id: string): Promise<ServerInfo>;
  serverSet(
    id: string,
    server: Omit<ServerConfig, "hostKey"> | null,
    password?: string,
  ): Promise<ServerInfo>;
  serverTrust(id: string, fingerprint: string): Promise<ServerInfo>;
  serverTest(id: string): Promise<BackupResult>;
  backupNow(id: string): Promise<BackupResult>;
  fetchAll(id: string): Promise<BackupResult>;
  keepOut(id: string, on: boolean): Promise<ServerInfo>;
  onEvent(callback: (event: WorkspaceEvent) => void): () => void;
};

declare global {
  interface Window {
    excalidrawDesktop?: { version: number; workspace: DesktopWorkspaceBridge };
  }
}

/** the workspace bridge, or null when this is a plain browser */
export const getWorkspaceBridge = (): DesktopWorkspaceBridge | null =>
  typeof window !== "undefined"
    ? window.excalidrawDesktop?.workspace ?? null
    : null;
