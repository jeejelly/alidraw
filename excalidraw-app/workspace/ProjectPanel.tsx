import { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom, useSetAtom } from "../app-jotai";

import {
  getWorkspaceBridge,
  type Commit,
  type DesktopWorkspaceBridge,
  type GitStatus,
  type SceneEntry,
  type WorkspaceEntry,
} from "./desktopBridge";
import { openWorkspaceScene } from "./openWorkspaceScene";
import { SceneTreeView } from "./SceneTree";
import { activeWorkspaceAtom, workspaceDialogOpenAtom } from "./workspaceState";

import "./Workspace.scss";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

const mimeOf = (path: string) =>
  MIME[path.split(".").pop() ?? ""] ?? "image/png";

/** what a git status code means, in a word */
const changeKind = (code: string) =>
  code === "??" || code.includes("A")
    ? "new"
    : code.includes("D")
    ? "deleted"
    : code.includes("R")
    ? "renamed"
    : "changed";

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const PATHS = {
  plus: "M12 5v14M5 12h14",
  pencil: "M4 20l1-5L16 4l4 4L9 19zM14 6l4 4",
  copy: "M8.5 8.5h11v11h-11zM15.5 8.5V5h-11v11h4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  folder:
    "M3 6.5C3 5.7 3.7 5 4.5 5H9.5L11.5 7.5H19.5C20.3 7.5 21 8.2 21 9V18C21 18.8 20.3 19.5 19.5 19.5H4.5C3.7 19.5 3 18.8 3 18Z",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1",
  refresh: "M20 12a8 8 0 01-14 5.3M4 12a8 8 0 0114-5.3M20 4v5h-5M4 20v-5h5",
  down: "M12 4v11M7 10.5l5 5 5-5M4 20h16",
  up: "M12 16V5M7 9.5l5-5 5 5M4 20h16",
  check: "M5 12.5l5 5L19 7",
  image:
    "M3 5h18v14H3zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM3.5 17l5.5-5 4 4 3-3 4.5 4.5",
};

const IconButton = ({
  icon,
  title,
  onClick,
  disabled,
  testId,
}: {
  icon: keyof typeof PATHS;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) => (
  <button
    type="button"
    className="project__icon"
    title={title}
    aria-label={title}
    data-testid={testId}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon d={PATHS[icon]} />
  </button>
);

/**
 * The project browser: workspaces, their scenes (rename, duplicate, delete),
 * versions (commit, check for updates, pull, push), and the pictures kept
 * with the project. It lives in the palette so it is always at hand.
 */
export const ProjectPanel = ({ api }: { api: ExcalidrawImperativeAPI }) => {
  const bridge = getWorkspaceBridge() as DesktopWorkspaceBridge;
  const [active, setActive] = useAtom(activeWorkspaceAtom);
  const setSettingsOpen = useSetAtom(workspaceDialogOpenAtom);

  const [list, setList] = useState<WorkspaceEntry[]>([]);
  const [scenes, setScenes] = useState<SceneEntry[]>([]);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [assets, setAssets] = useState<{ path: string; bytes: number }[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<{
    path: string;
    value: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Commit[]>([]);

  const fileHandle = api.getAppState().fileHandle as unknown as
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
    await guard(async () => {
      setList(await bridge.list());
      if (active) {
        setScenes(await bridge.scenes(active.id));
        setStatus(await bridge.status(active.id));
        const found = await bridge.assets(active.id);
        setAssets(found);
        setHistory(
          currentPath ? await bridge.history(active.id, currentPath) : [],
        );
      } else {
        setScenes([]);
        setStatus(null);
        setAssets([]);
        setHistory([]);
      }
    });
  }, [bridge, active, currentPath, guard]);

  useEffect(() => {
    refresh();
    const off = bridge.onEvent(() => refresh());
    const timer = window.setInterval(refresh, 15000);
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [bridge, refresh]);

  // thumbnails of the pictures, loaded as they appear
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!active) {
      return;
    }
    for (const a of assets.slice(0, 40)) {
      const key = `${active.id}:${a.path}`;
      if (asked.current.has(key)) {
        continue;
      }
      asked.current.add(key);
      bridge
        .readAsset(active.id, a.path)
        .then((b64) =>
          setThumbs((t) => ({
            ...t,
            [key]: `data:${mimeOf(a.path)};base64,${b64}`,
          })),
        )
        .catch(() => {});
    }
  }, [assets, active, bridge]);

  const select = (id: string) => {
    const w = list.find((x) => x.id === id);
    if (!w) {
      setActive(null);
      return;
    }
    setActive({ id: w.id, name: w.name });
    bridge.activate(w.id).catch(() => {});
  };

  const open = (s: SceneEntry) =>
    guard(async () => {
      if (active) {
        await openWorkspaceScene(api, active, s.path);
      }
    });

  const changes = status && "changes" in status ? status.changes : [];
  const isRepo = !!(status && "repo" in status && status.repo);
  const hasRemote = !!(status && "remote" in status && status.remote);
  const ahead = status && "ahead" in status ? status.ahead : 0;
  const behind = status && "behind" in status ? status.behind : 0;
  const branch = status && "branch" in status ? status.branch : null;

  const run = (label: string, fn: () => Promise<unknown>) =>
    guard(async () => {
      setBusy(true);
      setNote(`${label}…`);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    }).then(refresh);

  const describe = (r: any): string => {
    switch (r?.outcome) {
      case "pushed":
        return "Pushed.";
      case "pulled":
        return `Pulled ${r.files?.length ?? 0} file(s).`;
      case "in-sync":
        return "Up to date.";
      case "diverged":
        return "Both sides have new commits: open the settings to merge or branch.";
      case "no-remote":
        return "Set a remote in the settings first.";
      case "paused":
        return "Network is paused.";
      default:
        return r?.message ?? "Done.";
    }
  };

  const commit = () =>
    run("Committing", async () => {
      const r = await bridge.commitNow(active!.id, message.trim() || undefined);
      setMessage("");
      setNote(r.hash ? `Committed ${r.hash}.` : "Nothing to commit.");
    });

  const sync = (options: { pull: boolean; push: boolean }, label: string) =>
    run(label, async () =>
      setNote(describe(await bridge.sync(active!.id, options))),
    );

  const create = () =>
    guard(async () => {
      const folder = await bridge.pickFolder();
      if (!folder) {
        return;
      }
      const w = await bridge.create({ name, token: folder.token });
      setName("");
      setCreating(false);
      setActive({ id: w.id, name: w.name });
    }).then(refresh);

  const openFolder = () =>
    guard(async () => {
      const folder = await bridge.pickFolder();
      if (!folder) {
        return;
      }
      const w = await bridge.open({ token: folder.token });
      setActive({ id: w.id, name: w.name });
      if (w.gitNote) {
        setError(w.gitNote);
      }
    }).then(refresh);

  const newScene = () =>
    guard(async () => {
      const path = await bridge.newScene(active!.id, "Untitled");
      await openWorkspaceScene(api, active!, path);
    }).then(refresh);

  const doRename = () => {
    const r = renaming;
    setRenaming(null);
    if (!r || !active) {
      return;
    }
    guard(async () => {
      const next = await bridge.renameScene(active.id, r.path, r.value);
      // the open file follows its new name
      if (r.path === currentPath) {
        await openWorkspaceScene(api, active, next);
      }
    }).then(refresh);
  };

  const insertAsset = (a: { path: string }) =>
    guard(async () => {
      const b64 = await bridge.readAsset(active!.id, a.path);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], a.path.split("/").pop()!, {
        type: mimeOf(a.path),
      });
      await api.importFiles([file], "image");
    });

  if (!bridge) {
    return null;
  }

  return (
    <div className="project" data-testid="project-panel">
      <div className="project__row">
        <select
          className="project__select"
          data-testid="project-select"
          value={active?.id ?? ""}
          onChange={(e) => select(e.target.value)}
        >
          <option value="">Choose a workspace…</option>
          {list.map((w) => (
            <option key={w.id} value={w.id} disabled={w.exists === false}>
              {w.name}
              {w.exists === false ? " (folder missing)" : ""}
            </option>
          ))}
        </select>
        <IconButton
          icon="folder"
          title="Use an existing folder as a workspace"
          onClick={openFolder}
          testId="project-open-folder"
        />
        <IconButton
          icon="plus"
          title="New workspace"
          onClick={() => setCreating((c) => !c)}
          testId="project-new"
        />
        <IconButton
          icon="gear"
          title="Settings: sharing, backup server, images"
          onClick={() => setSettingsOpen(true)}
          disabled={!active}
          testId="project-settings"
        />
      </div>

      {creating && (
        <div className="project__row">
          <input
            className="project__input"
            data-testid="project-name"
            placeholder="Name of the new workspace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && name.trim()) {
                create();
              }
            }}
          />
          <button
            type="button"
            className="project__button"
            disabled={!name.trim()}
            onClick={create}
            data-testid="project-create"
          >
            Choose folder…
          </button>
        </div>
      )}

      {error && (
        <div className="workspace__error" role="alert">
          {error}
        </div>
      )}

      {!active ? (
        <p className="workspace__hint">
          A workspace is a project folder, kept in git. Choose one, or make a
          new one.
        </p>
      ) : (
        <>
          <div className="project__status" data-testid="project-status">
            {isRepo ? (
              <>
                <span className="workspace__badge">⎇ {branch}</span>
                <span>
                  {changes.length
                    ? `${changes.length} change${changes.length > 1 ? "s" : ""}`
                    : "all committed"}
                </span>
                {hasRemote && (
                  <span title="to push / to pull">
                    ↑{ahead} ↓{behind}
                  </span>
                )}
              </>
            ) : (
              <span>Not under git</span>
            )}
          </div>

          <div className="project__head">
            <strong>Scenes</strong>
            <IconButton
              icon="plus"
              title="New scene"
              onClick={newScene}
              testId="project-new-scene"
            />
          </div>
          <ul
            className="workspace__scenes project__tree"
            data-testid="project-scenes"
          >
            <SceneTreeView
              scenes={scenes}
              closed={closed}
              onToggle={(p) => setClosed((c) => ({ ...c, [p]: !c[p] }))}
              leaf={(s, depth, label) =>
                renaming?.path === s.path ? (
                  <div
                    className="project__row"
                    style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
                  >
                    <input
                      autoFocus
                      className="project__input"
                      data-testid="project-rename-input"
                      value={renaming.value}
                      onChange={(e) =>
                        setRenaming({ path: s.path, value: e.target.value })
                      }
                      onBlur={doRename}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          doRename();
                        } else if (e.key === "Escape") {
                          setRenaming(null);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className={`project__scene${
                      s.path === currentPath ? " is-active" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="workspace__leaf"
                      data-testid="project-scene"
                      style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
                      title={s.path}
                      onClick={() => open(s)}
                    >
                      <span className="workspace__icon">▧</span>
                      {label}
                    </button>
                    <span className="project__actions">
                      <IconButton
                        icon="pencil"
                        title="Rename"
                        testId="project-rename"
                        onClick={() =>
                          setRenaming({ path: s.path, value: label })
                        }
                      />
                      <IconButton
                        icon="copy"
                        title="Duplicate"
                        testId="project-duplicate"
                        onClick={() =>
                          run("Duplicating", () =>
                            bridge.duplicateScene(active.id, s.path),
                          )
                        }
                      />
                      <IconButton
                        icon="trash"
                        title="Delete (git keeps its history)"
                        testId="project-delete"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${s.path}? Its versions stay in git.`,
                            )
                          ) {
                            run("Deleting", () =>
                              bridge.deleteScene(active.id, s.path),
                            );
                          }
                        }}
                      />
                    </span>
                  </div>
                )
              }
            />
            {scenes.length === 0 && (
              <li className="workspace__hint">No scenes yet.</li>
            )}
          </ul>

          {isRepo && (
            <>
              <div className="project__head">
                <strong>Versions</strong>
              </div>
              <div className="project__row">
                <input
                  className="project__input"
                  data-testid="project-message"
                  placeholder="Describe this version (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && changes.length) {
                      commit();
                    }
                  }}
                />
                <button
                  type="button"
                  className="project__button project__button--primary"
                  data-testid="project-commit"
                  disabled={busy || changes.length === 0}
                  onClick={commit}
                >
                  Commit
                </button>
              </div>
              <div className="project__row project__row--tools">
                <IconButton
                  icon="refresh"
                  title="Check for updates"
                  testId="project-check"
                  disabled={busy || !hasRemote}
                  onClick={() => sync({ pull: false, push: false }, "Checking")}
                />
                <IconButton
                  icon="down"
                  title="Pull"
                  testId="project-pull"
                  disabled={busy || !hasRemote}
                  onClick={() => sync({ pull: true, push: false }, "Pulling")}
                />
                <IconButton
                  icon="up"
                  title="Push"
                  testId="project-push"
                  disabled={busy || !hasRemote}
                  onClick={() => sync({ pull: false, push: true }, "Pushing")}
                />
                <IconButton
                  icon="check"
                  title="Sync: pull then push"
                  testId="project-sync"
                  disabled={busy || !hasRemote}
                  onClick={() => sync({ pull: true, push: true }, "Syncing")}
                />
                {behind > 0 && (
                  <span
                    className="workspace__badge"
                    data-testid="project-behind"
                  >
                    {behind} to pull
                  </span>
                )}
              </div>
              {note && (
                <p className="workspace__hint" data-testid="project-note">
                  {note}
                </p>
              )}
              {changes.length > 0 && (
                <ul className="project__changes" data-testid="project-changes">
                  {changes.slice(0, 20).map((c) => {
                    const kind = changeKind(c.code);
                    const slash = c.path.lastIndexOf("/");
                    return (
                      <li key={c.path} title={c.path}>
                        <span className={`project__tag project__tag--${kind}`}>
                          {kind}
                        </span>
                        <span className="project__file">
                          {slash >= 0 && (
                            <span className="project__dir">
                              {c.path.slice(0, slash + 1)}
                            </span>
                          )}
                          {c.path.slice(slash + 1)}
                        </span>
                      </li>
                    );
                  })}
                  {changes.length > 20 && <li>… {changes.length - 20} more</li>}
                </ul>
              )}
              {currentPath && history.length > 0 && (
                <details className="project__history">
                  <summary>History of {currentPath.split("/").pop()}</summary>
                  <ul>
                    {history.slice(0, 15).map((c) => (
                      <li key={c.hash}>
                        <span>{c.subject}</span>
                        <button
                          type="button"
                          className="project__button"
                          onClick={() =>
                            guard(async () => {
                              const text = await bridge.showVersion(
                                active.id,
                                c.hash,
                                currentPath,
                              );
                              await openWorkspaceScene(
                                api,
                                active,
                                currentPath,
                                text,
                              );
                            })
                          }
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}

          <div className="project__head">
            <strong>Pictures</strong>
            <IconButton
              icon="image"
              title="Import SVG and images into the design"
              testId="project-import"
              onClick={() => api.importFromPicker()}
            />
          </div>
          <div className="project__assets" data-testid="project-assets">
            {assets.length === 0 && (
              <span className="workspace__hint">No linked pictures yet.</span>
            )}
            {assets.slice(0, 40).map((a) => {
              const src = thumbs[`${active.id}:${a.path}`];
              return (
                <button
                  key={a.path}
                  type="button"
                  className="project__asset"
                  data-testid="project-asset"
                  title={`${a.path} — click to put it on the canvas`}
                  onClick={() => insertAsset(a)}
                >
                  {src ? <img src={src} alt="" /> : <Icon d={PATHS.image} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
