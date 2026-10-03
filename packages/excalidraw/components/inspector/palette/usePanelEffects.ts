import { useEffect, useState } from "react";

import { INSPECTOR_FOCUS_TRANSFORM } from "./types";

import type App from "../../App";

/** The scene mutates elements in place: repaint on any change. */
export const useRepaintOnSceneChange = (app: App) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = app.scene.onUpdate(() => setTick((tick) => tick + 1));
    return () => {
      try {
        unsubscribe();
      } catch {
        // scene destroyed first
      }
    };
  }, [app]);
};

/** Ctrl+T: jump to the transform fields. */
export const useFocusTransformShortcut = (
  rootRef: React.RefObject<HTMLDivElement | null>,
  showDesignTab: () => void,
) => {
  useEffect(() => {
    const focusTransform = () => {
      showDesignTab();
      requestAnimationFrame(() => {
        rootRef.current
          ?.querySelector<HTMLInputElement>(
            '[data-testid="W"] input, [data-testid="W"]',
          )
          ?.focus();
      });
    };
    window.addEventListener(INSPECTOR_FOCUS_TRANSFORM, focusTransform);
    return () =>
      window.removeEventListener(INSPECTOR_FOCUS_TRANSFORM, focusTransform);
    // showDesignTab only sets state, so it is stable in effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
