import type { GitStatus } from "./desktopBridge";

/** Flattens the GitStatus union into the values the views read. */
export const viewGitStatus = (status: GitStatus | null) => {
  const inRepo = !!status && "repo" in status && status.repo;
  return {
    isRepo: inRepo,
    changes: status && "changes" in status ? status.changes : [],
    hasRemote: !!(status && "remote" in status && status.remote),
    syncInfo: status && "sync" in status ? status.sync : null,
    paused: !!(status && "paused" in status && status.paused),
    ahead: status && "ahead" in status ? status.ahead : 0,
    behind: status && "behind" in status ? status.behind : 0,
    branch: status && "branch" in status ? status.branch : null,
  };
};
