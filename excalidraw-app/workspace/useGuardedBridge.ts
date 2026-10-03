import { useCallback, useState } from "react";

import type { DesktopWorkspaceBridge } from "./desktopBridge";
import type { ActiveWorkspace } from "./workspaceState";

/** Runs bridge calls, surfacing failures as `error`; the user cancelling a picker is not one. */
export const useGuardedBridge = (
  bridge: DesktopWorkspaceBridge | null,
  active: ActiveWorkspace | null,
) => {
  const [error, setError] = useState<string | null>(null);

  const guard = useCallback(async <T>(action: () => Promise<T>) => {
    try {
      setError(null);
      return await action();
    } catch (caught: any) {
      if (caught?.name !== "AbortError") {
        setError(caught.message ?? String(caught));
      }
      return undefined;
    }
  }, []);

  const withBridge = <T>(
    action: (bridge: DesktopWorkspaceBridge) => Promise<T>,
  ) => guard(async () => (bridge ? action(bridge) : undefined));

  const withActive = <T>(
    action: (
      bridge: DesktopWorkspaceBridge,
      active: ActiveWorkspace,
    ) => Promise<T>,
  ) =>
    guard(async () => (bridge && active ? action(bridge, active) : undefined));

  return { error, setError, guard, withBridge, withActive };
};
