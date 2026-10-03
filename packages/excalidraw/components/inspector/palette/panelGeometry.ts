import { snapPanel } from "@excalidraw/color";

export const rectOf = (element: Element | null) => {
  const rect = element?.getBoundingClientRect();
  return rect && rect.width
    ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    : null;
};

/** Where a panel dragged to (x, y) ends up: clamped, then snapped (Alt: free). */
export const placePanel = (
  x: number,
  y: number,
  panel: Element | null,
  otherTestId: string,
  freeDrag: boolean,
) => {
  const size = rectOf(panel);
  const clampedX = Math.max(0, Math.min(window.innerWidth - 60, x));
  const clampedY = Math.max(0, Math.min(window.innerHeight - 40, y));
  if (!size || freeDrag) {
    return { x: clampedX, y: clampedY, edge: { right: false } };
  }
  const other = rectOf(
    document.querySelector(`[data-testid="${otherTestId}"]`),
  );
  return snapPanel(
    { ...size, x: clampedX, y: clampedY },
    other ? [other] : [],
    { width: window.innerWidth, height: window.innerHeight },
  );
};
