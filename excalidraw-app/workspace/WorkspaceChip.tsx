import { useEffect, useState } from "react";

import { useAtomValue, useSetAtom } from "../app-jotai";

import { getWorkspaceBridge, type GitStatus } from "./desktopBridge";
import { activeWorkspaceAtom, workspaceDialogOpenAtom } from "./workspaceState";

/** One line in the footer: the active workspace and what git says about it. */
export const WorkspaceChip = () => {
  const bridge = getWorkspaceBridge();
  const active = useAtomValue(activeWorkspaceAtom);
  const setOpen = useSetAtom(workspaceDialogOpenAtom);
  const [status, setStatus] = useState<GitStatus | null>(null);

  useEffect(() => {
    if (!bridge || !active) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    const load = () =>
      bridge
        .status(active.id)
        .then((gitStatus) => !cancelled && setStatus(gitStatus))
        .catch(() => !cancelled && setStatus(null));
    load();
    const timer = window.setInterval(load, 10000);
    const off = bridge.onEvent(load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      off();
    };
  }, [bridge, active]);

  if (!bridge) {
    return null;
  }
  const git =
    status && "repo" in status && status.repo
      ? `⎇ ${status.branch}${
          status.clean ? " ✓" : ` ● ${status.changes.length}`
        }`
      : status && !status.git
      ? "no git"
      : "";
  return (
    <button
      type="button"
      className="workspace-chip"
      data-testid="workspace-chip"
      onClick={() => setOpen(true)}
    >
      ▣ {active ? active.name : "No workspace"} {git}
    </button>
  );
};
