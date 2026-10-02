import { useSyncExternalStore } from "react";

import { ALL_THEMES, DEFAULT_THEME, type SymbolTheme } from "./theme";

/** the theme symbols are inserted with: a preset plus the user's changes, kept on this machine */
const KEY = "excalidraw-symbol-theme";

let state: SymbolTheme = DEFAULT_THEME;
const listeners = new Set<() => void>();

const legacyRadius = (v: unknown, fallback: number) =>
  v === "sharp"
    ? 0
    : v === "soft"
    ? 8
    : v === "round"
    ? 40
    : Number.isFinite(Number(v))
    ? Number(v)
    : fallback;

const read = (): SymbolTheme => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && raw.colors && raw.radius !== undefined) {
      const base = ALL_THEMES.find((t) => t.name === raw.base) ?? DEFAULT_THEME;
      return {
        ...base,
        name: String(raw.name ?? base.name),
        radius: ["sharp", "soft", "round"].includes(raw.radius)
          ? raw.radius
          : base.radius,
        stroke: Number(raw.stroke) > 0 ? Number(raw.stroke) : base.stroke,
        colors: { ...base.colors, ...raw.colors },
      };
    }
  } catch {
    // storage unavailable or damaged: the default theme
  }
  return DEFAULT_THEME;
};

state = read();

export const getSymbolTheme = () => state;

export const setSymbolTheme = (next: SymbolTheme) => {
  state = next;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...next,
        base: ALL_THEMES.find((t) => t.name === next.name)?.name,
      }),
    );
  } catch {
    // not kept this session
  }
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useSymbolTheme = () =>
  useSyncExternalStore(subscribe, getSymbolTheme);
