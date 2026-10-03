export type PanelRect = { x: number; y: number; width: number; height: number };

export const PANEL_SNAP_DISTANCE = 12;
export const PANEL_MARGIN = 12;
const PANEL_GAP = 8;

const nearest = (
  value: number,
  candidates: readonly number[],
  limit: number,
) => {
  let best = value;
  let bestDistance = limit + 1e-9;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - value);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
};

/**
 * Pulls a dragged panel onto the screen edges (with a margin) and onto its
 * neighbours: side by side, or edge to edge.
 */
export const snapPanel = (
  rect: PanelRect,
  others: readonly PanelRect[],
  viewport: { width: number; height: number },
  limit = PANEL_SNAP_DISTANCE,
): { x: number; y: number; edge: { right: boolean } } => {
  const xs = [PANEL_MARGIN, viewport.width - rect.width - PANEL_MARGIN];
  const ys = [PANEL_MARGIN, viewport.height - rect.height - PANEL_MARGIN];
  for (const other of others) {
    xs.push(
      other.x - rect.width - PANEL_GAP, // to its left
      other.x + other.width + PANEL_GAP, // to its right
      other.x, // left edges aligned
      other.x + other.width - rect.width, // right edges aligned
    );
    ys.push(
      other.y, // tops aligned
      other.y + other.height - rect.height, // bottoms aligned
      other.y + other.height + PANEL_GAP, // below it
      other.y - rect.height - PANEL_GAP, // above it
    );
  }
  const x = nearest(rect.x, xs, limit);
  const y = nearest(rect.y, ys, limit);
  return {
    x,
    y,
    edge: { right: x === viewport.width - rect.width - PANEL_MARGIN },
  };
};
