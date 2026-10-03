import { formatAgo } from "./formatAgo";
import { Fold } from "./Fold";

import type { Commit } from "./desktopBridge";

export const VersionHistoryFold = ({
  currentPath,
  history,
  onRestore,
}: {
  currentPath: string | null;
  history: Commit[];
  onRestore: (commit: Commit) => void;
}) => (
  <Fold id="history" title="History" badge={currentPath ?? ""}>
    {currentPath && history.length > 0 ? (
      <ul className="workspace__history">
        {history.map((commit) => (
          <li key={commit.hash}>
            <span>{commit.subject}</span>
            <time>{formatAgo(commit.date)}</time>
            <button
              type="button"
              data-testid="workspace-restore"
              onClick={() => onRestore(commit)}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="workspace__hint">Open a scene to see its versions.</p>
    )}
  </Fold>
);
