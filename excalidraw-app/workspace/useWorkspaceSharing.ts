import { useState } from "react";

import type {
  DesktopWorkspaceBridge,
  ResolveOutcome,
  SyncOutcome,
  WorkspaceEntry,
} from "./desktopBridge";
import type { useGuardedBridge } from "./useGuardedBridge";

const describeSync = (result: SyncOutcome) => {
  switch (result.outcome) {
    case "pushed":
      return "Pushed.";
    case "pulled":
      return `Pulled ${result.files.length} file${
        result.files.length === 1 ? "" : "s"
      }.`;
    case "in-sync":
      return "Up to date.";
    case "diverged":
      return "Both sides have new commits: choose what to do below.";
    case "no-remote":
      return "Set a remote address first.";
    case "paused":
      return "Network is paused.";
    default:
      return result.message ?? "Could not sync.";
  }
};

const describeResolution = (result: ResolveOutcome) => {
  switch (result.outcome) {
    case "merged":
      return "Merged. Push to share it.";
    case "branched":
      return `Continuing on ${result.branch}.`;
    case "conflict":
      return `Cannot merge automatically: ${result.conflicts.join(
        ", ",
      )} changed on both sides. Nothing was changed.`;
    default:
      return null;
  }
};

/** Remote address, sync and divergence resolution, and the per-workspace settings. */
export const useWorkspaceSharing = ({
  bridge,
  guarded,
  refresh,
  settings,
  setSettings,
  remoteUrl,
}: {
  bridge: DesktopWorkspaceBridge | null;
  guarded: ReturnType<typeof useGuardedBridge>;
  refresh: () => Promise<void>;
  settings: WorkspaceEntry["settings"];
  setSettings: (settings: WorkspaceEntry["settings"]) => void;
  remoteUrl: string;
}) => {
  const [notice, setNotice] = useState<string | null>(null);
  const { guard, withActive } = guarded;

  const runSync = (options?: { pull?: boolean; push?: boolean }) =>
    withActive(async (activeBridge, active) => {
      setNotice("Syncing…");
      setNotice(describeSync(await activeBridge.sync(active.id, options)));
    }).then(refresh);

  const resolve = (choice: "merge" | "branch") =>
    withActive(async (activeBridge, active) => {
      setNotice(
        describeResolution(await activeBridge.resolve(active.id, choice)),
      );
    }).then(refresh);

  const saveRemote = () =>
    withActive(async (activeBridge, active) => {
      await activeBridge.remoteSet(active.id, remoteUrl.trim());
      setNotice("Remote saved.");
    }).then(refresh);

  const saveSettings = (patch: WorkspaceEntry["settings"]) =>
    withActive(async (activeBridge, active) => {
      setSettings(
        await activeBridge
          .getSettings(active.id)
          .then(() => ({ ...settings, ...patch })),
      );
      await activeBridge.setSettings(active.id, patch);
    });

  const setPaused = (paused: boolean) =>
    guard(async () => bridge?.setPaused(paused)).then(refresh);

  return {
    notice,
    setNotice,
    runSync,
    resolve,
    saveRemote,
    saveSettings,
    setPaused,
  };
};
