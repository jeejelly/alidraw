/** The user's colour swatches and panel layout: app-wide, kept in localStorage. */
import { normalizeHex } from "./hex";

export type Swatch = Readonly<{ id: string; name: string; color: string }>;

/** docked to the right edge, or floating as a strip / column */
export type PaletteLayout = "docked" | "horizontal" | "vertical";

export type PaletteState = Readonly<{
  swatches: readonly Swatch[];
  layout: PaletteLayout;
  /** viewport position of the panel's top-left corner */
  position: { x: number; y: number };
  /** the layers list lives in its own floating panel instead of a tab */
  layersDetached: boolean;
  layersPosition: { x: number; y: number };
  /** width of the panel in px (docked or floating as a column) */
  width: number;
  /** height of the panel in px, or null to fit the content */
  height: number | null;
  /** tools the user took off the Tools section (ids, see ToolsSection) */
  hiddenTools: readonly string[];
}>;

const STORAGE_KEY = "excalidraw-palette";
export const PALETTE_SWATCH_LIMIT = 500;

export const DEFAULT_PALETTE_STATE: PaletteState = {
  swatches: [],
  layout: "docked",
  position: { x: 80, y: 120 },
  layersDetached: false,
  layersPosition: { x: 120, y: 160 },
  width: 264,
  height: null,
  hiddenTools: [],
};

export const sanitizePaletteState = (raw: unknown): PaletteState => {
  const value = (raw ?? {}) as Partial<PaletteState>;
  const seen = new Set<string>();
  const swatches: Swatch[] = [];
  for (const candidate of Array.isArray(value.swatches) ? value.swatches : []) {
    const color = normalizeHex(candidate?.color);
    if (
      color &&
      typeof candidate.id === "string" &&
      !seen.has(candidate.id) &&
      swatches.length < PALETTE_SWATCH_LIMIT
    ) {
      seen.add(candidate.id);
      swatches.push({
        id: candidate.id,
        color,
        name:
          typeof candidate.name === "string"
            ? candidate.name.slice(0, 80)
            : color,
      });
    }
  }
  const pos = value.position;
  return {
    swatches,
    layout:
      value.layout === "vertical" || value.layout === "horizontal"
        ? value.layout
        : "docked",
    position:
      pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)
        ? { x: pos.x, y: pos.y }
        : DEFAULT_PALETTE_STATE.position,
    layersDetached: value.layersDetached === true,
    layersPosition:
      value.layersPosition &&
      Number.isFinite(value.layersPosition.x) &&
      Number.isFinite(value.layersPosition.y)
        ? { x: value.layersPosition.x, y: value.layersPosition.y }
        : DEFAULT_PALETTE_STATE.layersPosition,
    width:
      typeof value.width === "number" &&
      Number.isFinite(value.width) &&
      value.width >= 240
        ? Math.min(720, Math.round(value.width))
        : DEFAULT_PALETTE_STATE.width,
    height:
      typeof value.height === "number" &&
      Number.isFinite(value.height) &&
      value.height >= 160
        ? Math.min(4000, Math.round(value.height))
        : null,
    hiddenTools: Array.isArray(value.hiddenTools)
      ? [
          ...new Set(
            value.hiddenTools.filter(
              (tag): tag is string =>
                typeof tag === "string" && tag.length < 40,
            ),
          ),
        ]
      : [],
  };
};

let state: PaletteState | null = null;
const listeners = new Set<() => void>();

const load = (): PaletteState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizePaletteState(JSON.parse(raw)) : DEFAULT_PALETTE_STATE;
  } catch {
    return DEFAULT_PALETTE_STATE;
  }
};

export const getPaletteState = (): PaletteState => (state ??= load());

export const subscribePalette = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const commit = (next: PaletteState) => {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: the palette lives on for this session
  }
  listeners.forEach((cb) => cb());
};

/** drops the in-memory copy so the next read reloads from storage */
export const resetPaletteCache = () => {
  state = null;
  listeners.forEach((cb) => cb());
};

let nextId = 0;
const newId = () =>
  `sw${Date.now().toString(36)}${(nextId++).toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

export const addSwatch = (color: string, name?: string): Swatch | null => {
  const hex = normalizeHex(color);
  const current = getPaletteState();
  if (!hex || current.swatches.length >= PALETTE_SWATCH_LIMIT) {
    return null;
  }
  const swatch = { id: newId(), color: hex, name: name?.trim() || hex };
  commit({ ...current, swatches: [...current.swatches, swatch] });
  return swatch;
};

export const renameSwatch = (id: string, name: string) => {
  const current = getPaletteState();
  commit({
    ...current,
    swatches: current.swatches.map((swatch) =>
      swatch.id === id
        ? { ...swatch, name: name.trim().slice(0, 80) || swatch.color }
        : swatch,
    ),
  });
};

export const setSwatchColor = (id: string, color: string) => {
  const hex = normalizeHex(color);
  if (!hex) {
    return;
  }
  const current = getPaletteState();
  commit({
    ...current,
    swatches: current.swatches.map((swatch) =>
      swatch.id === id
        ? {
            ...swatch,
            color: hex,
            name: swatch.name === swatch.color ? hex : swatch.name,
          }
        : swatch,
    ),
  });
};

/** puts a swatch where another one is: the list is reordered by dragging */
export const moveSwatch = (id: string, beforeId: string | null) => {
  const current = getPaletteState();
  const moving = current.swatches.find((swatch) => swatch.id === id);
  if (!moving || id === beforeId) {
    return;
  }
  const rest = current.swatches.filter((swatch) => swatch.id !== id);
  const at = beforeId
    ? rest.findIndex((swatch) => swatch.id === beforeId)
    : rest.length;
  rest.splice(at < 0 ? rest.length : at, 0, moving);
  commit({ ...current, swatches: rest });
};

export const removeSwatch = (id: string) => {
  const current = getPaletteState();
  commit({
    ...current,
    swatches: current.swatches.filter((swatch) => swatch.id !== id),
  });
};

export const setPaletteLayout = (layout: PaletteLayout) =>
  commit({ ...getPaletteState(), layout });

export const setLayersDetached = (layersDetached: boolean) =>
  commit({ ...getPaletteState(), layersDetached });

export const setToolHidden = (id: string, hidden: boolean) => {
  const current = getPaletteState();
  const rest = current.hiddenTools.filter((tool) => tool !== id);
  commit({ ...current, hiddenTools: hidden ? [...rest, id] : rest });
};

export const PALETTE_MIN_WIDTH = 240;
export const PALETTE_MAX_WIDTH = 720;

export const setPaletteWidth = (width: number) =>
  commit({
    ...getPaletteState(),
    width: Math.min(
      PALETTE_MAX_WIDTH,
      Math.max(PALETTE_MIN_WIDTH, Math.round(width)),
    ),
  });

export const PALETTE_MIN_HEIGHT = 160;

/** the panel's height; null goes back to fitting its content */
export const setPaletteHeight = (height: number | null) =>
  commit({
    ...getPaletteState(),
    height:
      height === null
        ? null
        : Math.min(4000, Math.max(PALETTE_MIN_HEIGHT, Math.round(height))),
  });

export const setLayersPosition = (layersPosition: { x: number; y: number }) =>
  commit({ ...getPaletteState(), layersPosition });

export const setPalettePosition = (position: { x: number; y: number }) =>
  commit({ ...getPaletteState(), position });

/** adds imported colours, skipping ones already present with the same name */
export const addSwatches = (
  colors: readonly { name: string; color: string }[],
): number => {
  const current = getPaletteState();
  const have = new Set(
    current.swatches.map((swatch) => `${swatch.color}|${swatch.name}`),
  );
  const added: Swatch[] = [];
  for (const entry of colors) {
    const hex = normalizeHex(entry.color);
    const name = entry.name.trim().slice(0, 80) || hex;
    if (
      hex &&
      name &&
      !have.has(`${hex}|${name}`) &&
      current.swatches.length + added.length < PALETTE_SWATCH_LIMIT
    ) {
      have.add(`${hex}|${name}`);
      added.push({ id: newId(), color: hex, name });
    }
  }
  if (added.length) {
    commit({ ...current, swatches: [...current.swatches, ...added] });
  }
  return added.length;
};
