import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { useCallback, useEffect, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom, useSetAtom } from "../app-jotai";

import {
  getWorkspaceBridge,
  type Commit,
  type GitStatus,
  type SceneEntry,
  type WorkspaceEntry,
} from "./desktopBridge";
import { openWorkspaceScene } from "./openWorkspaceScene";
import { activeWorkspaceAtom, workspaceDialogOpenAtom } from "./workspaceState";

import "./Workspace.scss";

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) {
    return "just now";
  }
  if (s < 5400) {
    return `${Math.round(s / 60)} min ago`;
  }
  if (s < 129600) {
    return `${Math.round(s / 3600)} h ago`;
  }
  return `${Math.round(s / 86400)} d ago`;
};

/** Workspaces: named project folders, kept in git, opened and saved without file dialogs. */
export const WorkspaceDialog = ({
  api,
}: {
  api: ExcalidrawImperativeAPI | null;
}) => {
  const bridge = getWorkspaceBridge();
  const [open, setOpen] = useAtom(workspaceDialogOpenAtom);
  const [active, setActive] = useAtom(activeWorkspaceAtom);

  const [list, setList] = useState<WorkspaceEntry[]>([]);
  const [scenes, setScenes] = useState<SceneEntry[]>([]);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [history, setHistory] = useState<Commit[]>([]);
  const [gitInfo, setGitInfo] = useState<{
    installed: boolean;
    help: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<WorkspaceEntry["settings"]>({});

  const fileHandle = api?.getAppState().fileHandle as unknown as
    | { workspaceId?: string; path?: string }
    | undefined;
  const currentPath =
    fileHandle?.workspaceId && fileHandle.workspaceId === active?.id
      ? fileHandle.path ?? null
      : null;

  const guard = useCallback(async <T,>(fn: () => Promise<T>) => {
    try {
      setError(null);
      return await fn();
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e.message ?? String(e));
      }
      return undefined;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!bridge) {
      return;
    }
    await guard(async () => {
      setList(await bridge.list());
      setGitInfo(await bridge.gitInfo());
      if (active) {
        setScenes(await bridge.scenes(active.id));
        setStatus(await bridge.status(active.id));
        setSettings(await bridge.getSettings(active.id));
        setHistory(
          currentPath ? await bridge.history(active.id, currentPath) : [],
        );
      } else {
        setScenes([]);
        setStatus(null);
        setHistory([]);
      }
    });
  }, [bridge, active, currentPath, guard]);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  useEffect(() => {
    if (!bridge || !open) {
      return;
    }
    return bridge.onEvent(() => refresh());
  }, [bridge, open, refresh]);

  const setWorkspaceActive = useSetAtom(activeWorkspaceAtom);

  if (!bridge || !open) {
    return null;
  }

  const select = (w: WorkspaceEntry) =>
    setWorkspaceActive({ id: w.id, name: w.name });

  const create = () =>
    guard(async () => {
      const folder = await bridge.pickFolder();
      if (!folder) {
        return;
      }
      const w = await bridge.create({ name, token: folder.token });
      setName("");
      select(w);
    }).then(refresh);

  const openFolder = () =>
    guard(async () => {
      const folder = await bridge.pickFolder();
      if (!folder) {
        return;
      }
      const w = await bridge.open({ token: folder.token });
      select(w);
      if (w.gitNote) {
        setError(w.gitNote);
      }
    }).then(refresh);

  const openScene = (s: SceneEntry) =>
    guard(async () => {
      if (!api || !active) {
        return;
      }
      await openWorkspaceScene(api, active, s.path);
      setOpen(false);
    });

  const newScene = () =>
    guard(async () => {
      if (!api || !active) {
        return;
      }
      const path = await bridge.newScene(active.id, "Untitled");
      await openWorkspaceScene(api, active, path);
      setOpen(false);
    });

  const restore = (c: Commit) =>
    guard(async () => {
      if (!api || !active || !currentPath) {
        return;
      }
      const text = await bridge.showVersion(active.id, c.hash, currentPath);
      // opened as the current file: the next save records it as a new version
      await openWorkspaceScene(api, active, currentPath, text);
      setOpen(false);
    });

  const save = (patch: WorkspaceEntry["settings"]) =>
    guard(async () => {
      if (!active) {
        return;
      }
      setSettings(
        await bridge
          .getSettings(active.id)
          .then(() => ({ ...settings, ...patch })),
      );
      await bridge.setSettings(active.id, patch);
    });

  const changes = status && "changes" in status ? status.changes : [];

  return (
    <Dialog
      onCloseRequest={() => setOpen(false)}
      title="Workspaces"
      size="wide"
      className="workspace-dialog"
    >
      {gitInfo && !gitInfo.installed && (
        <div className="workspace__banner" data-testid="git-missing">
          git is not installed, so workspaces cannot be versioned yet.{" "}
          {gitInfo.help}
          <button
            type="button"
            onClick={() =>
              guard(async () => {
                const r = await bridge.installGit();
                if (r.help) {
                  setError(r.help);
                }
                setGitInfo(await bridge.gitInfo());
              })
            }
          >
            Install git
          </button>
        </div>
      )}
      {error && (
        <div className="workspace__error" role="alert">
          {error}
        </div>
      )}

      <div className="workspace__cols">
        <section>
          <h4>Workspaces</h4>
          {list.length === 0 && (
            <p className="workspace__hint">
              A workspace is a folder for a project. Save a scene and choose a
              folder, or create one here.
            </p>
          )}
          <ul className="workspace__list">
            {list.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className={`workspace__item${
                    active?.id === w.id ? " is-active" : ""
                  }`}
                  data-testid="workspace-item"
                  disabled={w.exists === false}
                  onClick={() => select(w)}
                >
                  <strong>{w.name}</strong>
                  <span>{w.exists === false ? "folder missing" : w.path}</span>
                </button>
                <button
                  type="button"
                  className="workspace__forget"
                  title="Remove from the list (files stay)"
                  onClick={() =>
                    guard(async () => {
                      await bridge.forget(w.id);
                      if (active?.id === w.id) {
                        setWorkspaceActive(null);
                      }
                    }).then(refresh)
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="workspace__new">
            <input
              data-testid="workspace-name"
              placeholder="Name of a new workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              data-testid="workspace-create"
              disabled={!name.trim()}
              onClick={create}
            >
              Choose folder and create
            </button>
          </div>
          <button
            type="button"
            data-testid="workspace-open-folder"
            onClick={openFolder}
          >
            Use an existing folder…
          </button>
        </section>

        <section>
          {active ? (
            <>
              <h4>{active.name}</h4>
              <div className="workspace__git" data-testid="workspace-git">
                {!status || !("repo" in status) ? null : !status.repo ? (
                  <span>Not under git</span>
                ) : (
                  <>
                    <span>⎇ {status.branch}</span>
                    <span>
                      {changes.length
                        ? `${changes.length} change${
                            changes.length > 1 ? "s" : ""
                          }${status.pending ? " (committing soon)" : ""}`
                        : "all committed"}
                    </span>
                    {status.upstream && (
                      <span>
                        ↑{status.ahead} ↓{status.behind}
                      </span>
                    )}
                  </>
                )}
                {status && "repo" in status && status.repo && (
                  <button
                    type="button"
                    data-testid="workspace-commit-now"
                    disabled={changes.length === 0}
                    onClick={() =>
                      guard(() => bridge.commitNow(active.id)).then(refresh)
                    }
                  >
                    Commit now
                  </button>
                )}
              </div>
              <label className="workspace__setting">
                <input
                  type="checkbox"
                  data-testid="workspace-autocommit"
                  checked={settings.autoCommit !== false}
                  onChange={(e) => save({ autoCommit: e.target.checked })}
                />
                Commit automatically after
                <input
                  type="number"
                  min={5}
                  max={3600}
                  value={settings.delaySec ?? 60}
                  disabled={settings.autoCommit === false}
                  onChange={(e) => save({ delaySec: +e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                />
                s without edits
              </label>

              <h5>Scenes</h5>
              <button
                type="button"
                data-testid="workspace-new-scene"
                onClick={newScene}
              >
                ＋ New scene
              </button>
              <ul className="workspace__scenes">
                {scenes.map((s) => (
                  <li key={s.path}>
                    <button
                      type="button"
                      data-testid="workspace-scene"
                      className={s.path === currentPath ? "is-active" : ""}
                      onClick={() => openScene(s)}
                    >
                      {s.path}
                    </button>
                  </li>
                ))}
                {scenes.length === 0 && (
                  <li className="workspace__hint">No scenes yet.</li>
                )}
              </ul>

              {currentPath && history.length > 0 && (
                <>
                  <h5>History of {currentPath}</h5>
                  <ul className="workspace__history">
                    {history.map((c) => (
                      <li key={c.hash}>
                        <span>{c.subject}</span>
                        <time>{ago(c.date)}</time>
                        <button
                          type="button"
                          data-testid="workspace-restore"
                          onClick={() => restore(c)}
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="workspace__hint">
              Choose a workspace to see its scenes.
            </p>
          )}
        </section>
      </div>
    </Dialog>
  );
};
