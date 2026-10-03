import type { GitStatus } from "./desktopBridge";

export const WorkspaceGitHeader = ({
  name,
  status,
  changeCount,
  onCommitNow,
}: {
  name: string;
  status: GitStatus | null;
  changeCount: number;
  onCommitNow: () => void;
}) => (
  <header className="workspace__header">
    <h4>{name}</h4>
    <div className="workspace__git" data-testid="workspace-git">
      {!status || !("repo" in status) ? null : !status.repo ? (
        <span>Not under git</span>
      ) : (
        <>
          <span className="workspace__badge">⎇ {status.branch}</span>
          <span>
            {changeCount
              ? `${changeCount} change${changeCount > 1 ? "s" : ""}${
                  status.pending ? " (committing soon)" : ""
                }`
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
          disabled={changeCount === 0}
          onClick={onCommitNow}
        >
          Commit now
        </button>
      )}
    </div>
  </header>
);
