import { EVENT } from "@excalidraw/common";

type GestureHandlers = {
  onPointerMove?: (event: PointerEvent) => void;
  onPointerUp?: (event: PointerEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
};

/**
 * Lets a gesture own the pointer on the window until release.
 * @returns the function that removes the listeners again
 */
export const listenToGesture = (
  win: Window,
  { onPointerMove, onPointerUp, onKeyDown }: GestureHandlers,
): (() => void) => {
  const listeners = [
    [EVENT.POINTER_MOVE, onPointerMove],
    [EVENT.POINTER_UP, onPointerUp],
    [EVENT.KEYDOWN, onKeyDown],
  ] as const;
  for (const [type, listener] of listeners) {
    if (listener) {
      win.addEventListener(type, listener as EventListener);
    }
  }
  return () => {
    for (const [type, listener] of listeners) {
      if (listener) {
        win.removeEventListener(type, listener as EventListener);
      }
    }
  };
};

/** a keydown handler that only reacts to Escape */
export const onEscape =
  (action: () => void) =>
  (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      action();
    }
  };
