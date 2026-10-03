/** SVG colours and the presentation attributes that inherit down the tree. */
const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  lime: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  navy: "#000080",
  teal: "#008080",
  aqua: "#00ffff",
  cyan: "#00ffff",
  fuchsia: "#ff00ff",
  magenta: "#ff00ff",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  gold: "#ffd700",
};

export const parseColor = (value: string | undefined | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "none" || normalized === "transparent") {
    return "transparent";
  }
  if (normalized === "currentcolor") {
    return "#000000";
  }
  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return normalized;
  }
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return `#${[...normalized.slice(1)].map((char) => char + char).join("")}`;
  }
  const rgb = /^rgba?\(([^)]+)\)/.exec(normalized);
  if (rgb) {
    const parts = rgb[1].split(/[ ,/]+/).filter(Boolean);
    const ch = parts
      .slice(0, 3)
      .map((part) =>
        part.endsWith("%")
          ? Math.round((parseFloat(part) / 100) * 255)
          : Math.round(parseFloat(part)),
      );
    if (ch.length === 3 && ch.every(Number.isFinite)) {
      return `#${ch
        .map((channel) =>
          Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"),
        )
        .join("")}`;
    }
  }
  return NAMED[normalized] ?? null;
};

export type Style = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
};

export const DEFAULT_STYLE: Style = {
  fill: "#000000",
  stroke: "transparent",
  strokeWidth: 1,
  opacity: 1,
  fontSize: 16,
};

export const styleOf = (el: Element, parent: Style): Style => {
  const get = (name: string) => {
    const inline = el.getAttribute("style");
    if (inline) {
      const match = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(
        inline,
      );
      if (match) {
        return match[1].trim();
      }
    }
    return el.getAttribute(name) ?? undefined;
  };
  const fill = parseColor(get("fill"));
  const stroke = parseColor(get("stroke"));
  const sw = parseFloat(get("stroke-width") ?? "");
  const op = parseFloat(get("opacity") ?? "");
  const fop = parseFloat(get("fill-opacity") ?? "");
  const fs = parseFloat(get("font-size") ?? "");
  return {
    fill: fill ?? parent.fill,
    stroke: stroke ?? parent.stroke,
    strokeWidth: Number.isFinite(sw) ? sw : parent.strokeWidth,
    opacity:
      parent.opacity *
      (Number.isFinite(op) ? op : 1) *
      (Number.isFinite(fop) && fill && fill !== "transparent" ? fop : 1),
    fontSize: Number.isFinite(fs) ? fs : parent.fontSize,
  };
};
