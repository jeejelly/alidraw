/**
 * The user's colour swatches: app-wide, kept in localStorage, with import from
 * .gpl and .ase swatch palettes.
 */
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
  hiddenTools: [],
};

// -----------------------------------------------------------------------------
// colours
// -----------------------------------------------------------------------------

const byteToHex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

export const rgbToHex = (r: number, g: number, b: number) =>
  `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;

/** "#abc" / "#aabbcc" -> "#aabbcc"; null for anything else */
export const normalizeHex = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) {
    return null;
  }
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h}`;
};

// -----------------------------------------------------------------------------
// state
// -----------------------------------------------------------------------------

export const sanitizePaletteState = (raw: unknown): PaletteState => {
  const value = (raw ?? {}) as Partial<PaletteState>;
  const seen = new Set<string>();
  const swatches: Swatch[] = [];
  for (const s of Array.isArray(value.swatches) ? value.swatches : []) {
    const color = normalizeHex(s?.color);
    if (
      color &&
      typeof s.id === "string" &&
      !seen.has(s.id) &&
      swatches.length < PALETTE_SWATCH_LIMIT
    ) {
      seen.add(s.id);
      swatches.push({
        id: s.id,
        color,
        name: typeof s.name === "string" ? s.name.slice(0, 80) : color,
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
    hiddenTools: Array.isArray(value.hiddenTools)
      ? [
          ...new Set(
            value.hiddenTools.filter(
              (t): t is string => typeof t === "string" && t.length < 40,
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
    swatches: current.swatches.map((s) =>
      s.id === id ? { ...s, name: name.trim().slice(0, 80) || s.color } : s,
    ),
  });
};

export const removeSwatch = (id: string) => {
  const current = getPaletteState();
  commit({ ...current, swatches: current.swatches.filter((s) => s.id !== id) });
};

export const setPaletteLayout = (layout: PaletteLayout) =>
  commit({ ...getPaletteState(), layout });

export const setLayersDetached = (layersDetached: boolean) =>
  commit({ ...getPaletteState(), layersDetached });

export const setToolHidden = (id: string, hidden: boolean) => {
  const current = getPaletteState();
  const rest = current.hiddenTools.filter((t) => t !== id);
  commit({ ...current, hiddenTools: hidden ? [...rest, id] : rest });
};

export const setLayersPosition = (layersPosition: { x: number; y: number }) =>
  commit({ ...getPaletteState(), layersPosition });

export const setPalettePosition = (position: { x: number; y: number }) =>
  commit({ ...getPaletteState(), position });

/** adds imported colours, skipping ones already present with the same name */
export const addSwatches = (
  colors: readonly { name: string; color: string }[],
): number => {
  const current = getPaletteState();
  const have = new Set(current.swatches.map((s) => `${s.color}|${s.name}`));
  const added: Swatch[] = [];
  for (const c of colors) {
    const hex = normalizeHex(c.color);
    const name = c.name.trim().slice(0, 80) || hex;
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

// -----------------------------------------------------------------------------
// import
// -----------------------------------------------------------------------------

export type ImportedColor = { name: string; color: string };

/** .gpl palette: "R G B  name" lines after a "GIMP Palette" header line */
export const parseGpl = (text: string): ImportedColor[] => {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (!/^GIMP Palette/i.test(lines[0]?.trim() ?? "")) {
    return [];
  }
  const colors: ImportedColor[] = [];
  for (const line of lines.slice(1)) {
    const m = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/.exec(line);
    if (m) {
      const [r, g, b] = [m[1], m[2], m[3]].map(Number);
      if (r <= 255 && g <= 255 && b <= 255) {
        const color = rgbToHex(r, g, b);
        colors.push({ color, name: m[4]?.trim() || color });
      }
    }
  }
  return colors;
};

/** ASE swatch files: RGB, Gray and CMYK colour entries (Lab is skipped) */
export const parseAse = (buffer: ArrayBuffer): ImportedColor[] => {
  const view = new DataView(buffer);
  if (buffer.byteLength < 12 || view.getUint32(0) !== 0x41534546) {
    return [];
  }
  const blocks = view.getUint32(8);
  const colors: ImportedColor[] = [];
  let offset = 12;
  for (let i = 0; i < blocks && offset + 6 <= buffer.byteLength; i++) {
    const type = view.getUint16(offset);
    const length = view.getUint32(offset + 2);
    const start = offset + 6;
    const end = start + length;
    if (end > buffer.byteLength) {
      break;
    }
    if (type === 0x0001) {
      let p = start;
      const nameLength = view.getUint16(p);
      p += 2;
      let name = "";
      for (let k = 0; k < nameLength - 1; k++) {
        name += String.fromCharCode(view.getUint16(p + k * 2));
      }
      p += nameLength * 2;
      const model = String.fromCharCode(
        ...[0, 1, 2, 3].map((k) => view.getUint8(p + k)),
      );
      p += 4;
      const f = (k: number) => view.getFloat32(p + k * 4);
      let rgb: [number, number, number] | null = null;
      if (model === "RGB ") {
        rgb = [f(0) * 255, f(1) * 255, f(2) * 255];
      } else if (model === "Gray") {
        rgb = [f(0) * 255, f(0) * 255, f(0) * 255];
      } else if (model === "CMYK") {
        const k = f(3);
        rgb = [
          255 * (1 - f(0)) * (1 - k),
          255 * (1 - f(1)) * (1 - k),
          255 * (1 - f(2)) * (1 - k),
        ];
      }
      if (rgb) {
        const color = rgbToHex(...rgb);
        colors.push({ name: name.trim() || color, color });
      }
    }
    offset = end;
  }
  return colors;
};

export const parsePaletteFile = async (
  file: File,
): Promise<ImportedColor[]> => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ase")) {
    return parseAse(await file.arrayBuffer());
  }
  if (name.endsWith(".gpl")) {
    return parseGpl(await file.text());
  }
  return [];
};

// -----------------------------------------------------------------------------
// panel snapping
// -----------------------------------------------------------------------------

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
  let bestD = limit + 1e-9;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d < bestD) {
      best = c;
      bestD = d;
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
  for (const o of others) {
    xs.push(
      o.x - rect.width - PANEL_GAP, // to its left
      o.x + o.width + PANEL_GAP, // to its right
      o.x, // left edges aligned
      o.x + o.width - rect.width, // right edges aligned
    );
    ys.push(
      o.y, // tops aligned
      o.y + o.height - rect.height, // bottoms aligned
      o.y + o.height + PANEL_GAP, // below it
      o.y - rect.height - PANEL_GAP, // above it
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
