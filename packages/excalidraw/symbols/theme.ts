/** The tokens every symbol is coloured from. Change the theme, the symbols follow. */
export type Token =
  | "page"
  | "surface"
  | "surfaceAlt"
  | "border"
  | "text"
  | "muted"
  | "accent"
  | "onAccent"
  | "success"
  | "danger";

/** corner radius of controls in px; the maximum draws full pills */
export const MAX_RADIUS = 40;

export type SymbolTheme = {
  name: string;
  colors: Record<Token, string>;
  radius: number;
  /** stroke width of outlines and icons */
  stroke: number;
};

export const TOKENS: readonly Token[] = [
  "page",
  "surface",
  "surfaceAlt",
  "border",
  "text",
  "muted",
  "accent",
  "onAccent",
  "success",
  "danger",
];

export const THEMES: readonly SymbolTheme[] = [
  ...([] as SymbolTheme[]),
  {
    name: "Light",
    radius: 8,
    stroke: 1.5,
    colors: {
      page: "#f6f7f9",
      surface: "#ffffff",
      surfaceAlt: "#eef0f4",
      border: "#cfd4dc",
      text: "#1b1e24",
      muted: "#6b7280",
      accent: "#4f46e5",
      onAccent: "#ffffff",
      success: "#16a34a",
      danger: "#dc2626",
    },
  },
  {
    name: "Dark",
    radius: 8,
    stroke: 1.5,
    colors: {
      page: "#16171b",
      surface: "#1f2127",
      surfaceAlt: "#2a2d35",
      border: "#3a3e48",
      text: "#f1f2f4",
      muted: "#9aa0ac",
      accent: "#818cf8",
      onAccent: "#12131a",
      success: "#34d399",
      danger: "#f87171",
    },
  },
  {
    name: "Night pink",
    radius: MAX_RADIUS,
    stroke: 1.5,
    colors: {
      page: "#1b1b22",
      surface: "#2a2a33",
      surfaceAlt: "#34343f",
      border: "#44444f",
      text: "#f3f3f5",
      muted: "#9a9aa8",
      accent: "#f472b6",
      onAccent: "#2a1220",
      success: "#2dd4a0",
      danger: "#ff6b6b",
    },
  },
  {
    name: "Ocean",
    radius: 8,
    stroke: 1.5,
    colors: {
      page: "#eef6fb",
      surface: "#ffffff",
      surfaceAlt: "#e1eef7",
      border: "#b7d0e2",
      text: "#0f2a3d",
      muted: "#5b7a90",
      accent: "#0284c7",
      onAccent: "#ffffff",
      success: "#059669",
      danger: "#e11d48",
    },
  },
  {
    name: "Forest",
    radius: 8,
    stroke: 1.5,
    colors: {
      page: "#14201a",
      surface: "#1c2c24",
      surfaceAlt: "#26392f",
      border: "#37503f",
      text: "#e8f3ec",
      muted: "#93ad9c",
      accent: "#4ade80",
      onAccent: "#0c1a12",
      success: "#86efac",
      danger: "#fb7185",
    },
  },
  {
    name: "Mono sharp",
    radius: 0,
    stroke: 2,
    colors: {
      page: "#ffffff",
      surface: "#ffffff",
      surfaceAlt: "#ededed",
      border: "#111111",
      text: "#111111",
      muted: "#666666",
      accent: "#111111",
      onAccent: "#ffffff",
      success: "#111111",
      danger: "#111111",
    },
  },
];

export const TONAL_THEMES: readonly SymbolTheme[] = [
  {
    name: "Tonal light",
    radius: MAX_RADIUS,
    stroke: 1.5,
    colors: {
      page: "#fef7ff",
      surface: "#f7f2fa",
      surfaceAlt: "#e8def8",
      border: "#cac4d0",
      text: "#1d1b20",
      muted: "#49454f",
      accent: "#6750a4",
      onAccent: "#ffffff",
      success: "#386a20",
      danger: "#b3261c",
    },
  },
  {
    name: "Tonal dark",
    radius: MAX_RADIUS,
    stroke: 1.5,
    colors: {
      page: "#141218",
      surface: "#1d1b20",
      surfaceAlt: "#4a4458",
      border: "#49454f",
      text: "#e6e0e9",
      muted: "#cac4d0",
      accent: "#d0bcff",
      onAccent: "#381e72",
      success: "#9bd67f",
      danger: "#f2b8b5",
    },
  },
];

export const ALL_THEMES: readonly SymbolTheme[] = [...THEMES, ...TONAL_THEMES];

export const DEFAULT_THEME = THEMES[2];

/** the radius of controls and of cards, in px, for a control of height `h` */
export const radiusOf = (theme: SymbolTheme, kind: "ctl" | "card", h = 40) => {
  const full = theme.radius >= MAX_RADIUS;
  return kind === "ctl"
    ? full
      ? h / 2
      : theme.radius
    : full
    ? 20
    : Math.min(theme.radius * 1.5, 28);
};
