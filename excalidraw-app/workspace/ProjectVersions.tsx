import { useState } from "react";

import { IconButton } from "./ProjectIcons";
import { ProjectChangeList } from "./ProjectChangeList";

import type { Commit } from "./desktopBridge";

type SyncOptions = { pull: boolean; push: boolean };

const SYNC_BUTTONS: {
  icon: "refresh" | "down" | "up" | "check";
  title: string;
  testId: string;
  options: SyncOptions;
  label: string;
}[] = [
  {
    icon: "refresh",
    title: "Check for updates",
    testId: "project-check",
    options: { pull: false, push: false },
    label: "Checking",
  },
  {
    icon: "down",
    title: "Pull",
    testId: "project-pull",
    options: { pull: true, push: false },
    label: "Pulling",
  },
  {
    icon: "up",
    title: "Push",
    testId: "project-push",
    options: { pull: false, push: true },
    label: "Pushing",
  },
  {
    icon: "check",
    title: "Sync: pull then push",
    testId: "project-sync",
    options: { pull: true, push: true },
    label: "Syncing",
  },
];

/** Commit box, sync buttons, pending changes and the history of the open scene. */
export const ProjectVersions = ({
  changes,
  hasRemote,
  behind,
  busy,
  note,
  currentPath,
  history,
  onCommit,
  onSync,
  onRestore,
}: {
  changes: { path: string; code: string }[];
  hasRemote: boolean;
  behind: number;
  busy: boolean;
  note: string | null;
  currentPath: string | null;
  history: Commit[];
  onCommit: (message: string, onCommitted: () => void) => void;
  onSync: (options: SyncOptions, label: string) => void;
  onRestore: (commit: Commit) => void;
}) => {
  const [message, setMessage] = useState("");
  const commit = () => onCommit(message, () => setMessage(""));

  return (
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
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter" && changes.length) {
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
        {SYNC_BUTTONS.map(({ icon, title, testId, options, label }) => (
          <IconButton
            key={testId}
            icon={icon}
            title={title}
            testId={testId}
            disabled={busy || !hasRemote}
            onClick={() => onSync(options, label)}
          />
        ))}
        {behind > 0 && (
          <span className="workspace__badge" data-testid="project-behind">
            {behind} to pull
          </span>
        )}
      </div>
      {note && (
        <p className="workspace__hint" data-testid="project-note">
          {note}
        </p>
      )}
      {changes.length > 0 && <ProjectChangeList changes={changes} />}
      {currentPath && history.length > 0 && (
        <details className="project__history">
          <summary>History of {currentPath.split("/").pop()}</summary>
          <ul>
            {history.slice(0, 15).map((version) => (
              <li key={version.hash}>
                <span>{version.subject}</span>
                <button
                  type="button"
                  className="project__button"
                  onClick={() => onRestore(version)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
};
