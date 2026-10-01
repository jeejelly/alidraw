import {
  arcPts,
  defaultsOf,
  deg,
  E,
  I,
  L,
  p,
  R,
  T,
  type ComponentDef,
  type Param,
  type Shape,
  type Values,
} from "./shapes";

import type { Token } from "./theme";

const STATES = ["enabled", "hover", "focus", "pressed", "disabled"] as const;

const stateParam: Param = {
  key: "state",
  label: "State",
  kind: "choice",
  def: "enabled",
  options: STATES,
};

const num = (
  key: string,
  label: string,
  def: number,
  min: number,
  max: number,
): Param => ({ key, label, kind: "number", def, min, max });
const bool = (key: string, label: string, def: boolean): Param => ({
  key,
  label,
  kind: "bool",
  def,
});
const text = (key: string, label: string, def: string): Param => ({
  key,
  label,
  kind: "text",
  def,
});
const pick = (
  key: string,
  label: string,
  def: string,
  options: readonly string[],
): Param => ({ key, label, kind: "choice", def, options });

const ICON_CHOICES = [
  "none",
  "play",
  "plus",
  "download",
  "search",
  "menu",
  "close",
  "check",
  "heart",
  "star",
  "settings",
  "share",
  "layers",
  "folder-plus",
  "trash",
  "pencil",
  "more-vertical",
  "arrow-left",
  "user",
  "bell",
];

/** approximate width of a text at a size, enough to size pills and tabs */
const tw = (s: string, size: number) => Math.ceil(s.length * size * 0.58);
const list = (s: string) =>
  String(s)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * How a state changes a control: hover and pressed add an outline, focus a
 * ring, disabled greys it out.
 */
const look = (state: string, f: Token | null, s: Token | null, ink: Token) => {
  switch (state) {
    case "hover":
      return { f, s: s ?? "text", ink, sw: 1, ring: false };
    case "pressed":
      return { f, s: "text" as Token, ink, sw: 2.5, ring: false };
    case "focus":
      return { f, s, ink, sw: 1, ring: true };
    case "disabled":
      return {
        f: f ? ("surfaceAlt" as Token) : null,
        s: s ? ("border" as Token) : null,
        ink: "muted" as Token,
        sw: 1,
        ring: false,
      };
    default:
      return { f, s, ink, sw: 1, ring: false };
  }
};

const ring = (x: number, y: number, w: number, h: number, r: any): Shape =>
  R(x - 4, y - 4, w + 8, h + 8, { r, f: null, s: "accent", sw: 2 });

const button = p(
  "button",
  "Button",
  "Buttons",
  [
    text("label", "Label", "Continue"),
    pick("look", "Look", "primary", [
      "primary",
      "tonal",
      "elevated",
      "secondary",
      "outline",
      "danger",
      "text",
    ]),
    pick("icon", "Icon", "none", ICON_CHOICES),
    num("width", "Width", 140, 60, 480),
    stateParam,
  ],
  (_t, v) => {
    const w = v.width;
    const base: Record<string, [Token | null, Token | null, Token]> = {
      primary: ["accent", null, "onAccent"],
      tonal: ["surfaceAlt", null, "text"],
      elevated: ["surface", "border", "accent"],
      secondary: ["surfaceAlt", "border", "text"],
      outline: [null, "accent", "accent"],
      danger: ["danger", null, "onAccent"],
      text: [null, null, "accent"],
    };
    const [f0, s0, i0] = base[v.look] ?? base.primary;
    const k = look(v.state, f0, s0, i0);
    const out: Shape[] = [];
    if (k.ring) {
      out.push(ring(0, 0, w, 40, "ctl"));
    }
    out.push(R(0, 0, w, 40, { r: "ctl", f: k.f, s: k.s, sw: k.sw }));
    const hasIcon = v.icon !== "none";
    const lw = tw(v.label, 14);
    const total = lw + (hasIcon ? 28 : 0);
    const x0 = (w - total) / 2;
    if (hasIcon) {
      out.push(I(v.icon, x0, 10, 20, k.ink));
    }
    out.push(
      T(v.label, x0 + (hasIcon ? 28 : 0) + lw / 2, 20, 14, k.ink, "middle"),
    );
    return out;
  },
  "cta action submit",
);

const iconButton = p(
  "icon-button",
  "Icon button",
  "Buttons",
  [
    pick("icon", "Icon", "play", ICON_CHOICES.slice(1)),
    pick("look", "Look", "filled", ["filled", "soft", "outline", "plain"]),
    num("size", "Size", 40, 28, 80),
    bool("round", "Round", true),
    stateParam,
  ],
  (_t, v) => {
    const z = v.size;
    const base: Record<string, [Token | null, Token | null, Token]> = {
      filled: ["accent", null, "onAccent"],
      soft: ["surfaceAlt", null, "accent"],
      outline: [null, "border", "text"],
      plain: [null, null, "text"],
    };
    const [f0, s0, i0] = base[v.look] ?? base.filled;
    const k = look(v.state, f0, s0, i0);
    const r = v.round ? "pill" : "ctl";
    return [
      ...(k.ring ? [ring(0, 0, z, z, r)] : []),
      R(0, 0, z, z, { r, f: k.f, s: k.s, sw: k.sw }),
      I(v.icon, z * 0.25, z * 0.25, z * 0.5, k.ink),
    ];
  },
  "pill round play",
);

const iconButtons = p(
  "icon-buttons",
  "Icon button row",
  "Buttons",
  [
    text("icons", "Icons", "play,layers,download"),
    pick("look", "Look", "filled", ["filled", "soft", "outline"]),
    num("size", "Size", 40, 28, 64),
    num("gap", "Gap", 8, 0, 24),
  ],
  (_t, v) =>
    list(v.icons).flatMap((ic, k): Shape[] => {
      const x = k * (v.size + v.gap);
      const [f0, s0, i0]: [Token | null, Token | null, Token] =
        v.look === "soft"
          ? ["surfaceAlt", null, "accent"]
          : v.look === "outline"
          ? [null, "border", "text"]
          : ["accent", null, "onAccent"];
      return [
        R(x, 0, v.size, v.size, { r: "pill", f: f0, s: s0 }),
        I(ic, x + v.size * 0.25, v.size * 0.25, v.size * 0.5, i0),
      ];
    }),
  "actions toolbar",
);

const toggle = p(
  "toggle",
  "Toggle",
  "Inputs",
  [
    bool("on", "On", true),
    text("label", "Label", ""),
    bool("icon", "Check icon in thumb", false),
    num("size", "Size", 28, 20, 48),
    stateParam,
  ],
  (_t, v) => {
    const h = v.size;
    const w = Math.round(h * 1.72);
    const k = look(
      v.state,
      v.on ? "accent" : "surfaceAlt",
      v.on ? "accent" : "border",
      v.on ? "onAccent" : "muted",
    );
    const d = h - 8;
    const out: Shape[] = [];
    if (k.ring) {
      out.push(ring(0, 0, w, h, "pill"));
    }
    out.push(
      R(0, 0, w, h, { r: "pill", f: k.f, s: k.s, sw: k.sw }),
      E(v.on ? w - 4 - d : 4, 4, d, d, { f: k.ink, s: null }),
    );
    if (v.icon) {
      out.push(
        I(
          v.on ? "check" : "close",
          (v.on ? w - 4 - d : 4) + d * 0.2,
          4 + d * 0.2,
          d * 0.6,
          v.on ? "accent" : "surface",
        ),
      );
    }
    if (v.label) {
      out.push(
        T(
          v.label,
          w + 12,
          h / 2,
          14,
          v.state === "disabled" ? "muted" : "text",
        ),
      );
    }
    return out;
  },
  "switch on off",
);

const checkbox = p(
  "checkbox",
  "Checkbox",
  "Inputs",
  [
    pick("value", "Value", "checked", ["checked", "unchecked", "mixed"]),
    text("label", "Label", "Remember me"),
    stateParam,
  ],
  (_t, v) => {
    const on = v.value !== "unchecked";
    const k = look(
      v.state,
      on ? "accent" : "surface",
      on ? "accent" : "border",
      "onAccent",
    );
    return [
      ...(k.ring ? [ring(0, 2, 20, 20, 6)] : []),
      R(0, 2, 20, 20, { r: 5, f: k.f, s: k.s, sw: k.sw }),
      ...(v.value === "checked"
        ? [
            L(
              [
                [5, 12],
                [9, 16],
                [16, 8],
              ],
              { s: k.ink, sw: 2 },
            ),
          ]
        : v.value === "mixed"
        ? [
            L(
              [
                [5, 12],
                [15, 12],
              ],
              { s: k.ink, sw: 2 },
            ),
          ]
        : []),
      ...(v.label
        ? [T(v.label, 30, 12, 14, v.state === "disabled" ? "muted" : "text")]
        : []),
    ];
  },
  "check tick",
);

const radio = p(
  "radio",
  "Radio",
  "Inputs",
  [bool("on", "Selected", true), text("label", "Label", "Option"), stateParam],
  (_t, v) => {
    const k = look(v.state, "surface", v.on ? "accent" : "border", "accent");
    return [
      ...(k.ring ? [E(-4, -2, 28, 28, { f: null, s: "accent", sw: 2 })] : []),
      E(0, 2, 20, 20, { f: k.f, s: k.s, sw: k.sw }),
      ...(v.on ? [E(5, 7, 10, 10, { f: k.ink, s: null })] : []),
      ...(v.label
        ? [T(v.label, 30, 12, 14, v.state === "disabled" ? "muted" : "text")]
        : []),
    ];
  },
);

const pills = p(
  "pills",
  "Pills and chips",
  "Display",
  [
    text(
      "labels",
      "Labels (comma separated)",
      "All, Recipes, Drinks, Sweets, Snacks",
    ),
    num("active", "Active (1-based, 0 none)", 1, 0, 12),
    pick("look", "Look", "filled", ["filled", "outline", "soft"]),
    bool("wrap", "Wrap in rows", false),
    num("width", "Wrap width", 340, 120, 800),
    bool("close", "Close icon", false),
    pick("kind", "Kind", "plain", [
      "plain",
      "assist",
      "filter",
      "input",
      "suggestion",
    ]),
    stateParam,
  ],
  (_t, v) => {
    const out: Shape[] = [];
    let x = 0;
    let y = 0;
    list(v.labels).forEach((lb, k) => {
      const lead =
        v.kind === "assist" || (v.kind === "filter" && v.active === k + 1)
          ? 22
          : 0;
      const w =
        tw(lb, 13) + 28 + lead + (v.close || v.kind === "input" ? 20 : 0);
      if (v.wrap && x > 0 && x + w > v.width) {
        x = 0;
        y += 42;
      }
      const on = v.active === k + 1;
      const base: [Token | null, Token | null, Token] =
        on && v.look !== "outline"
          ? ["accent", null, "onAccent"]
          : v.look === "outline"
          ? [
              on ? "surfaceAlt" : null,
              on ? "accent" : "border",
              on ? "accent" : "text",
            ]
          : ["surfaceAlt", null, "accent"];
      const kk = look(on ? v.state : "enabled", ...base);
      out.push(
        R(x, y, w, 34, {
          r: v.kind === "plain" ? "pill" : 8,
          f: kk.f,
          s: kk.s,
          sw: kk.sw,
        }),
        T(lb, x + 14 + lead + tw(lb, 13) / 2, y + 17, 13, kk.ink, "middle"),
      );
      if (lead) {
        out.push(
          I(v.kind === "assist" ? "star" : "check", x + 8, y + 9, 16, kk.ink),
        );
      }
      if (v.close || v.kind === "input") {
        out.push(I("close", x + w - 26, y + 9, 16, kk.ink));
      }
      x += w + 8;
    });
    return out;
  },
  "chips filter tags pills",
);

const tabs = p(
  "tabs",
  "Tabs",
  "Navigation",
  [
    text("labels", "Labels", "All, Saved, Recent"),
    num("active", "Active (1-based)", 1, 1, 8),
    pick("style", "Style", "underline", [
      "underline",
      "pill",
      "segmented",
      "boxed",
    ]),
    num("width", "Width (0: fit)", 0, 0, 900),
    pick("icon", "Icons", "none", ["none", "music", "heart", "user", "folder"]),
  ],
  (_t, v) => {
    const labels = list(v.labels);
    const natural = labels.map(
      (l) => tw(l, 14) + 40 + (v.icon !== "none" ? 24 : 0),
    );
    const total = v.width || natural.reduce((a, b) => a + b, 0);
    const cell = v.width ? v.width / labels.length : 0;
    const widths = natural.map((n) => cell || n);
    const out: Shape[] = [];
    const sum = widths.reduce((a, b) => a + b, 0);
    if (v.style === "segmented") {
      out.push(R(0, 0, sum + 8, 40, { r: "ctl", f: "surfaceAlt", s: null }));
    } else if (v.style === "underline") {
      out.push(R(0, 43, total, 1, { f: "border", s: null }));
    } else if (v.style === "boxed") {
      out.push(R(0, 43, total, 1, { f: "border", s: null }));
    }
    let x = v.style === "segmented" ? 4 : 0;
    labels.forEach((lb, k) => {
      const w = widths[k];
      const on = v.active === k + 1;
      if (on) {
        if (v.style === "underline") {
          out.push(R(x + 8, 40, w - 16, 3, { r: 1, f: "accent", s: null }));
        } else if (v.style === "pill") {
          out.push(R(x, 4, w, 36, { r: "pill", f: "accent", s: null }));
        } else if (v.style === "segmented") {
          out.push(R(x, 0, w, 32, { r: "ctl", f: "surface", s: "border" }));
        } else {
          out.push(R(x, 0, w, 44, { r: 0, f: "surface", s: "border" }));
        }
      }
      const ink: Token = on
        ? v.style === "pill"
          ? "onAccent"
          : v.style === "underline"
          ? "accent"
          : "text"
        : "muted";
      const cy = v.style === "segmented" ? 16 : v.style === "pill" ? 22 : 20;
      const ic = v.icon !== "none";
      const tx = x + w / 2 + (ic ? 12 : 0);
      if (ic) {
        out.push(I(v.icon, tx - tw(lb, 14) / 2 - 24, cy - 10, 20, ink));
      }
      out.push(T(lb, tx, cy, 14, ink, "middle"));
      x += w;
    });
    return out;
  },
  "segmented control navigation",
);

const accordion = p(
  "collapsible-bars",
  "Collapsible bars",
  "Lists",
  [
    text("titles", "Titles", "Enabled, Hover, Focus, Pressed, Disabled"),
    text("open", "Open bars (1-based, comma separated)", "1"),
    num("children", "Nested bars in an open bar", 2, 0, 5),
    pick("icon", "Leading icon", "folder", [
      "none",
      "folder",
      "layers",
      "settings",
      "info",
    ]),
    num("width", "Width", 420, 200, 800),
    pick("style", "Style", "outlined", ["outlined", "filled", "plain"]),
    num("content", "Content height", 48, 0, 160),
  ],
  (_t, v) => {
    const open = new Set(list(v.open).map(Number));
    const titles = list(v.titles);
    const out: Shape[] = [];
    const w = v.width;
    let y = 0;
    const bar = (title: string, indent: number, isOpen: boolean) => {
      const h = 48;
      out.push(
        R(indent, y, w - indent, h, {
          r: 0,
          f: v.style === "filled" ? "surfaceAlt" : "surface",
          s: v.style === "plain" ? null : "border",
        }),
      );
      if (v.icon !== "none") {
        out.push(
          I(
            isOpen && v.icon === "folder" ? "folder-plus" : v.icon,
            indent + 14,
            y + 12,
            24,
            "text",
          ),
        );
      }
      out.push(
        T(title, indent + (v.icon !== "none" ? 52 : 16), y + h / 2, 14),
        I(isOpen ? "chevron-up" : "chevron-down", w - 40, y + 12, 24, "text"),
      );
      y += h;
    };
    titles.forEach((title, k) => {
      const isOpen = open.has(k + 1);
      bar(title, 0, isOpen);
      if (isOpen) {
        if (v.children > 0) {
          for (let c = 0; c < v.children; c++) {
            bar(
              `${title} / ${
                ["Outline", "Container", "Label", "Icon", "Shape"][c % 5]
              }`,
              12,
              false,
            );
          }
        } else if (v.content > 0) {
          out.push(
            R(0, y, w, v.content, { r: 0, f: "page", s: "border" }),
            T("Content", 16, y + v.content / 2, 13, "muted"),
          );
          y += v.content;
        }
      }
    });
    return out;
  },
  "accordion expand disclosure tree sections",
);

const slider = p(
  "slider",
  "Slider",
  "Inputs",
  [
    num("value", "Value", 60, 0, 100),
    bool("range", "Range (two thumbs)", false),
    num("from", "Range start", 25, 0, 100),
    num("steps", "Steps (0: continuous)", 0, 0, 20),
    text("label", "Label", ""),
    bool("showValue", "Show value", false),
    bool("bubble", "Value bubble", false),
    num("width", "Width", 240, 80, 600),
    stateParam,
  ],
  (_t, v) => {
    const w = v.width;
    const top = (v.label || v.showValue ? 26 : 0) + (v.bubble ? 30 : 0);
    const cy = top + 12;
    const x1 = (w * (v.range ? v.from : 0)) / 100;
    const x2 = (w * v.value) / 100;
    const k = look(v.state, "onAccent", "accent", "accent");
    const out: Shape[] = [];
    if (v.label) {
      out.push(T(v.label, 0, 8, 13, "muted"));
    }
    if (v.showValue) {
      out.push(T(String(v.value), w, 8, 13, "text", "end"));
    }
    out.push(
      R(0, cy - 2, w, 4, { r: "pill", f: "surfaceAlt", s: null }),
      R(Math.min(x1, x2), cy - 2, Math.abs(x2 - x1), 4, {
        r: "pill",
        f: v.state === "disabled" ? "border" : "accent",
        s: null,
      }),
    );
    for (let s = 0; v.steps > 0 && s <= v.steps; s++) {
      out.push(
        E((w * s) / v.steps - 2, cy - 2, 4, 4, {
          f: (s / v.steps) * 100 <= v.value ? "onAccent" : "muted",
          s: null,
        }),
      );
    }
    const thumb = (x: number) => {
      if (k.ring) {
        out.push(E(x - 14, cy - 14, 28, 28, { f: null, s: "accent", sw: 2 }));
      }
      out.push(E(x - 10, cy - 10, 20, 20, { f: k.f, s: k.s, sw: 2 }));
    };
    if (v.range) {
      thumb(x1);
    }
    thumb(x2);
    if (v.bubble) {
      out.push(
        R(x2 - 18, cy - 46, 36, 28, { r: "pill", f: "text", s: null }),
        T(String(v.value), x2, cy - 32, 12, "page", "middle"),
      );
    }
    return out;
  },
  "range volume track thumb",
);

const progress = p(
  "progress",
  "Progress",
  "Display",
  [
    num("value", "Value %", 62, 0, 100),
    pick("style", "Style", "bar", ["bar", "ring", "segments"]),
    bool("label", "Show value", true),
    num("width", "Size", 240, 40, 600),
  ],
  (_t, v) => {
    const w = v.width;
    const out: Shape[] = [];
    if (v.style === "ring") {
      const r = w / 2 - 6;
      out.push(
        L(arcPts(w / 2, w / 2, r, 0, Math.PI * 2, 40), {
          s: "surfaceAlt",
          sw: 6,
        }),
        L(
          arcPts(
            w / 2,
            w / 2,
            r,
            -Math.PI / 2,
            -Math.PI / 2 + (v.value / 100) * Math.PI * 2,
            36,
          ),
          { s: "accent", sw: 6 },
        ),
      );
      if (v.label) {
        out.push(
          T(`${v.value}%`, w / 2, w / 2, Math.max(11, w / 5), "text", "middle"),
        );
      }
    } else if (v.style === "segments") {
      const n = 10;
      const g = 4;
      const sw = (w - g * (n - 1)) / n;
      for (let k = 0; k < n; k++) {
        out.push(
          R(k * (sw + g), 0, sw, 8, {
            r: 3,
            f: k < Math.round((v.value / 100) * n) ? "accent" : "surfaceAlt",
            s: null,
          }),
        );
      }
      if (v.label) {
        out.push(T(`${v.value}%`, w, 24, 12, "muted", "end"));
      }
    } else {
      out.push(
        R(0, 0, w, 8, { r: "pill", f: "surfaceAlt", s: null }),
        R(0, 0, Math.max(8, (w * v.value) / 100), 8, {
          r: "pill",
          f: "accent",
          s: null,
        }),
      );
      if (v.label) {
        out.push(T(`${v.value}%`, w, 24, 12, "muted", "end"));
      }
    }
    return out;
  },
  "loading bar ring circular",
);

const knob = p(
  "knob",
  "Knob",
  "Inputs",
  [
    num("value", "Value", 65, 0, 100),
    text("label", "Label", "Level"),
    num("size", "Size", 68, 32, 160),
    bool("ticks", "Ticks", true),
    bool("showValue", "Show value", false),
    stateParam,
  ],
  (_t, v) => {
    const z = v.size;
    const cx = z / 2 + 10;
    const cy = z / 2 + 10;
    const a = deg(135 + (v.value / 100) * 270);
    const k = look(v.state, "surfaceAlt", "border", "accent");
    const out: Shape[] = [
      L(arcPts(cx, cy, z / 2 + 6, deg(135), deg(405)), {
        s: "surfaceAlt",
        sw: 4,
      }),
      L(arcPts(cx, cy, z / 2 + 6, deg(135), a, 20), {
        s: v.state === "disabled" ? "border" : "accent",
        sw: 4,
      }),
      ...(k.ring
        ? [E(6, 6, z + 8, z + 8, { f: null, s: "accent", sw: 2 })]
        : []),
      E(10, 10, z, z, { f: k.f, s: k.s, sw: k.sw }),
      L(
        [
          [cx + Math.cos(a) * (z * 0.18), cy + Math.sin(a) * (z * 0.18)],
          [cx + Math.cos(a) * (z * 0.42), cy + Math.sin(a) * (z * 0.42)],
        ],
        { s: k.ink, sw: 3 },
      ),
    ];
    if (v.ticks) {
      for (let t = 0; t <= 10; t++) {
        const ta = deg(135 + t * 27);
        const r1 = z / 2 + 14;
        const r2 = z / 2 + 18;
        out.push(
          L(
            [
              [cx + Math.cos(ta) * r1, cy + Math.sin(ta) * r1],
              [cx + Math.cos(ta) * r2, cy + Math.sin(ta) * r2],
            ],
            { s: "muted", sw: 1 },
          ),
        );
      }
    }
    const bottom = z + 34;
    if (v.label) {
      out.push(T(v.label, cx, bottom, 12, "muted", "middle"));
    }
    if (v.showValue) {
      out.push(T(String(v.value), cx, bottom + 16, 12, "text", "middle"));
    }
    return out;
  },
  "dial rotary potentiometer",
);

const stepper = p(
  "stepper",
  "Number stepper",
  "Inputs",
  [
    num("value", "Value", 3, 0, 999),
    pick("style", "Style", "inline", ["inline", "split"]),
  ],
  (_t, v) =>
    v.style === "split"
      ? [
          R(0, 0, 40, 40, { r: "pill", f: "surfaceAlt", s: null }),
          I("minus", 10, 10, 20, "accent"),
          T(String(v.value), 70, 20, 16, "text", "middle"),
          R(100, 0, 40, 40, { r: "pill", f: "accent", s: null }),
          I("plus", 110, 10, 20, "onAccent"),
        ]
      : [
          R(0, 0, 132, 40, { r: "ctl", f: "surface", s: "border" }),
          I("minus", 8, 10, 20, "muted"),
          T(String(v.value), 66, 20, 15, "text", "middle"),
          I("plus", 104, 10, 20, "muted"),
        ],
  "quantity counter",
);

const rating = p(
  "rating",
  "Rating",
  "Inputs",
  [
    num("value", "Value", 4, 0, 10),
    num("max", "Stars", 5, 1, 10),
    num("size", "Size", 24, 12, 48),
  ],
  (_t, v) =>
    Array.from({ length: v.max }, (_, k) =>
      I("star", k * (v.size + 2), 0, v.size, k < v.value ? "accent" : "border"),
    ),
  "stars review",
);

const pagination = p(
  "pagination",
  "Pagination",
  "Navigation",
  [num("pages", "Pages", 5, 2, 9), num("current", "Current", 1, 1, 9)],
  (_t, v) => {
    const out: Shape[] = [
      R(0, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
      I("chevron-left", 8, 8, 20, "muted"),
    ];
    for (let k = 1; k <= v.pages; k++) {
      const x = k * 44;
      const on = k === v.current;
      out.push(
        R(x, 0, 36, 36, {
          r: "ctl",
          f: on ? "accent" : "surface",
          s: on ? null : "border",
        }),
        T(String(k), x + 18, 18, 13, on ? "onAccent" : "text", "middle"),
      );
    }
    const x = (v.pages + 1) * 44;
    out.push(
      R(x, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
      I("chevron-right", x + 8, 8, 20, "muted"),
    );
    return out;
  },
);

const steps = p(
  "steps",
  "Step indicator",
  "Navigation",
  [
    text("labels", "Steps", "Account, Details, Done"),
    num("current", "Current (1-based)", 2, 1, 8),
    num("gap", "Spacing", 124, 60, 300),
  ],
  (_t, v) => {
    const labels = list(v.labels);
    const out: Shape[] = [];
    labels.forEach((lb, k) => {
      const x = k * v.gap;
      if (k > 0) {
        out.push(
          L(
            [
              [x - v.gap + 32, 16],
              [x, 16],
            ],
            { s: k < v.current ? "accent" : "border", sw: 2 },
          ),
        );
      }
      const done = k + 1 < v.current;
      const on = k + 1 === v.current;
      out.push(
        E(x, 0, 32, 32, {
          f: done ? "accent" : "surface",
          s: done || on ? "accent" : "border",
          sw: on ? 2 : 1,
        }),
      );
      if (done) {
        out.push(I("check", x + 8, 8, 16, "onAccent"));
      } else {
        out.push(
          T(String(k + 1), x + 16, 16, 13, on ? "accent" : "muted", "middle"),
        );
      }
      out.push(T(lb, x + 16, 46, 11, on ? "text" : "muted", "middle"));
    });
    return out;
  },
  "wizard progress",
);

const rows = p(
  "list",
  "List",
  "Lists",
  [
    num("rows", "Rows", 3, 1, 10),
    pick("lines", "Lines", "two", ["one", "two"]),
    pick("leading", "Leading", "icon", ["none", "icon", "avatar", "status"]),
    pick("trailing", "Trailing", "chevron", [
      "none",
      "chevron",
      "switch",
      "actions",
      "text",
    ]),
    num("selected", "Selected row (0 none)", 0, 0, 10),
    num("width", "Width", 340, 200, 700),
    pick("style", "Rows", "cards", ["cards", "lines"]),
  ],
  (_t, v) => {
    const out: Shape[] = [];
    const h = v.lines === "two" ? 64 : 48;
    const gap = v.style === "cards" ? 8 : 0;
    const titles = [
      "Chocolate milk",
      "Apple pie",
      "Tomato soup",
      "Pancakes",
      "Fruit salad",
      "Green tea",
      "Rice bowl",
      "Steps",
      "Lemon cake",
      "Blue",
    ];
    for (let k = 0; k < v.rows; k++) {
      const y = k * (h + gap);
      const sel = v.selected === k + 1;
      out.push(
        R(0, y, v.width, h, {
          r: v.style === "cards" ? "card" : 0,
          f: sel ? "surfaceAlt" : "surface",
          s: v.style === "cards" ? null : null,
        }),
      );
      if (v.style === "lines" && k < v.rows - 1) {
        out.push(R(0, y + h - 1, v.width, 1, { f: "border", s: null }));
      }
      let x = 14;
      if (v.leading === "icon") {
        out.push(I("music", x, y + h / 2 - 12, 24, "accent"));
        x += 40;
      } else if (v.leading === "avatar") {
        out.push(
          E(x, y + h / 2 - 18, 36, 36, { f: "accent", s: null }),
          T(titles[k % 10][0], x + 18, y + h / 2, 13, "onAccent", "middle"),
        );
        x += 50;
      } else if (v.leading === "status") {
        out.push(
          R(x - 4, y + 12, 4, h - 24, {
            r: 2,
            f: k % 4 === 3 ? "danger" : "success",
            s: null,
          }),
        );
        x += 12;
      }
      out.push(
        T(titles[k % 10], x, y + (v.lines === "two" ? h / 2 - 10 : h / 2), 14),
      );
      if (v.lines === "two") {
        out.push(T("Secondary text", x, y + h / 2 + 12, 12, "muted"));
      }
      const end = v.width - 14;
      if (v.trailing === "chevron") {
        out.push(I("chevron-right", end - 24, y + h / 2 - 12, 24, "muted"));
      } else if (v.trailing === "switch") {
        out.push(
          R(end - 48, y + h / 2 - 14, 48, 28, {
            r: "pill",
            f: k % 2 ? "surfaceAlt" : "accent",
            s: null,
          }),
          E(k % 2 ? end - 44 : end - 24, y + h / 2 - 10, 20, 20, {
            f: k % 2 ? "muted" : "onAccent",
            s: null,
          }),
        );
      } else if (v.trailing === "actions") {
        ["play", "download"].forEach((ic, a) => {
          const bx = end - 40 * (2 - a) - 6 * (1 - a);
          out.push(
            R(bx, y + h / 2 - 20, 40, 40, { r: "pill", f: "accent", s: null }),
            I(ic, bx + 10, y + h / 2 - 10, 20, "onAccent"),
          );
        });
      } else if (v.trailing === "text") {
        out.push(
          T(`${2 + k}:${10 + k * 7}`, end, y + h / 2, 13, "muted", "end"),
        );
      }
    }
    return out;
  },
  "rows items settings",
);

const table = p(
  "table",
  "Table",
  "Lists",
  [
    text("cols", "Columns", "Name, Source, Length"),
    num("rows", "Rows", 3, 1, 12),
    num("width", "Width", 360, 200, 800),
    bool("stripes", "Striped", false),
  ],
  (_t, v) => {
    const cols = list(v.cols);
    const cw = v.width / cols.length;
    const h = 36 + v.rows * 36;
    const out: Shape[] = [
      R(0, 0, v.width, h, { r: "card", f: "surface", s: "border" }),
      R(0, 0, v.width, 36, { r: 0, f: "surfaceAlt", s: null }),
    ];
    cols.forEach((c, k) => out.push(T(c, 16 + k * cw, 18, 12, "muted")));
    for (let r = 0; r < v.rows; r++) {
      const y = 36 + r * 36;
      if (v.stripes && r % 2) {
        out.push(R(1, y, v.width - 2, 36, { r: 0, f: "page", s: null }));
      }
      out.push(
        L(
          [
            [0, y],
            [v.width, y],
          ],
          { s: "border", sw: 1 },
        ),
      );
      cols.forEach((_c, k) =>
        out.push(
          T(
            k === 0
              ? ["Pancakes", "Apple pie", "Tomato soup", "Rice bowl", "Fruit salad"][r % 5]
              : k === 1
              ? "Recipes"
              : `${3 + (r % 4)}:${10 + r * 5}`,
            16 + k * cw,
            y + 18,
            13,
            k === 0 ? "text" : "muted",
          ),
        ),
      );
    }
    return out;
  },
  "grid data",
);

const appBar = p(
  "app-bar",
  "App bar",
  "Navigation",
  [
    text("title", "Title", "My app"),
    pick("size", "Size", "small", ["small", "center", "medium", "large"]),
    pick("leading", "Leading", "none", ["none", "menu", "arrow-left"]),
    num("actions", "Actions", 2, 0, 4),
    pick("look", "Look", "surface", ["surface", "accent"]),
    num("width", "Width", 360, 240, 900),
  ],
  (_t, v) => {
    const big = v.size === "large" || v.size === "medium";
    const h = v.size === "large" ? 152 : v.size === "medium" ? 112 : 56;
    const bg: Token = v.look === "accent" ? "accent" : "surface";
    const ink: Token = v.look === "accent" ? "onAccent" : "text";
    const out: Shape[] = [R(0, 0, v.width, h, { r: 0, f: bg, s: null })];
    if (v.leading !== "none") {
      out.push(I(v.leading, 14, 16, 24, ink));
    }
    const icons = ["download", "folder-plus", "search", "more-vertical"];
    for (let a = 0; a < v.actions; a++) {
      const x = v.width - 52 - a * 44;
      if (v.look === "surface") {
        out.push(
          R(x, 8, 40, 40, { r: "pill", f: "accent", s: null }),
          I(icons[a], x + 10, 18, 20, "onAccent"),
        );
      } else {
        out.push(I(icons[a], x + 8, 16, 24, ink));
      }
    }
    if (v.size === "center") {
      out.push(T(v.title, v.width / 2, 28, 18, ink, "middle"));
    } else if (big) {
      out.push(T(v.title, 16, h - 28, v.size === "large" ? 28 : 24, ink));
    } else {
      out.push(T(v.title, v.leading === "none" ? 16 : 56, 28, 18, ink));
    }
    return out;
  },
  "header toolbar top bar",
);

const searchBar = p(
  "search-bar",
  "Search bar",
  "Inputs",
  [
    text("placeholder", "Text", "Search or paste a link"),
    bool("filled", "Has text", false),
    pick("leading", "Leading", "search", ["search", "menu", "arrow-left"]),
    bool("avatar", "Avatar at the end", false),
    num("width", "Width", 320, 160, 800),
    stateParam,
  ],
  (_t, v) => {
    const k = look(v.state, "surfaceAlt", null, "text");
    const out: Shape[] = [];
    if (k.ring) {
      out.push(ring(0, 0, v.width, 48, "pill"));
    }
    out.push(
      R(0, 0, v.width, 48, { r: "pill", f: k.f, s: k.s, sw: k.sw }),
      I(v.leading, 14, 12, 24, "muted"),
      T(v.placeholder, 50, 24, 14, v.filled ? k.ink : "muted"),
    );
    if (v.avatar) {
      out.push(
        E(v.width - 42, 8, 32, 32, { f: "accent", s: null }),
        T("A", v.width - 26, 24, 13, "onAccent", "middle"),
      );
    } else if (v.filled) {
      out.push(I("close", v.width - 38, 12, 24, "muted"));
    }
    return out;
  },
  "field query",
);

const input = p(
  "input",
  "Text field",
  "Inputs",
  [
    text("label", "Label", "Email"),
    text("value", "Value", ""),
    text("helper", "Helper text", ""),
    pick("icon", "Leading icon", "none", ICON_CHOICES),
    pick("trailing", "Trailing icon", "none", ICON_CHOICES),
    bool("error", "Error", false),
    pick("style", "Style", "outlined", ["outlined", "filled"]),
    num("width", "Width", 280, 120, 700),
    stateParam,
  ],
  (_t, v) => {
    const top = v.label ? 22 : 0;
    const edge: Token | null = v.error
      ? "danger"
      : v.state === "focus"
      ? "accent"
      : v.style === "filled"
      ? null
      : "border";
    const k = look(
      v.state === "focus" ? "enabled" : v.state,
      v.style === "filled" ? "surfaceAlt" : "surface",
      edge,
      "text",
    );
    const out: Shape[] = [];
    if (v.label) {
      out.push(T(v.label, 0, 8, 12, v.error ? "danger" : "muted"));
    }
    out.push(
      R(0, top, v.width, 44, {
        r: "ctl",
        f: k.f,
        s: k.s,
        sw: v.state === "focus" ? 2 : k.sw,
      }),
    );
    let x = 14;
    if (v.icon !== "none") {
      out.push(I(v.icon, 12, top + 12, 20, "muted"));
      x = 42;
    }
    out.push(
      T(v.value || "Placeholder", x, top + 22, 14, v.value ? k.ink : "muted"),
    );
    if (v.trailing !== "none") {
      out.push(I(v.trailing, v.width - 32, top + 12, 20, "muted"));
    }
    if (v.helper) {
      out.push(T(v.helper, 0, top + 58, 12, v.error ? "danger" : "muted"));
    }
    return out;
  },
  "textbox form",
);

const select = p(
  "select",
  "Select",
  "Inputs",
  [
    text("value", "Value", "Choose one"),
    bool("open", "Open", false),
    text("options", "Options", "All, Saved, Recent"),
    num("width", "Width", 220, 120, 500),
  ],
  (_t, v) => {
    const out: Shape[] = [
      R(0, 0, v.width, 44, {
        r: "ctl",
        f: "surface",
        s: v.open ? "accent" : "border",
        sw: v.open ? 2 : 1,
      }),
      T(v.value, 14, 22, 14, v.value === "Choose one" ? "muted" : "text"),
      I(v.open ? "chevron-up" : "chevron-down", v.width - 32, 12, 20, "muted"),
    ];
    if (v.open) {
      const opts = list(v.options);
      out.push(
        R(0, 50, v.width, opts.length * 40 + 8, {
          r: "ctl",
          f: "surface",
          s: "border",
        }),
      );
      opts.forEach((o, k) =>
        out.push(T(o, 14, 74 + k * 40 - 4, 14, k === 0 ? "accent" : "text")),
      );
    }
    return out;
  },
  "dropdown combo",
);

const menu = p(
  "menu",
  "Menu",
  "Overlays",
  [
    text("items", "Items", "Rename, Duplicate, Share, Delete"),
    num("selected", "Highlighted (0 none)", 0, 0, 10),
    bool("icons", "Icons", true),
    num("width", "Width", 200, 120, 400),
  ],
  (_t, v) => {
    const items = list(v.items);
    const icons: Record<string, string> = {
      Rename: "pencil",
      Duplicate: "copy",
      Share: "share",
      Delete: "trash",
    };
    const out: Shape[] = [
      R(0, 0, v.width, items.length * 40 + 16, {
        r: "ctl",
        f: "surface",
        s: "border",
      }),
    ];
    items.forEach((it, k) => {
      const y = 8 + k * 40;
      const danger = /delete|remove/i.test(it);
      if (v.selected === k + 1) {
        out.push(
          R(6, y, v.width - 12, 40, { r: "ctl", f: "surfaceAlt", s: null }),
        );
      }
      if (v.icons) {
        out.push(
          I(
            icons[it] ?? "chevron-right",
            16,
            y + 10,
            20,
            danger ? "danger" : "muted",
          ),
        );
      }
      out.push(
        T(it, v.icons ? 48 : 16, y + 20, 14, danger ? "danger" : "text"),
      );
    });
    return out;
  },
  "context popover dropdown",
);

const dialog = p(
  "dialog",
  "Dialog",
  "Overlays",
  [
    text("title", "Title", "Delete collection?"),
    text("body", "Text", "This cannot be undone."),
    text("confirm", "Confirm", "Delete"),
    text("cancel", "Cancel", "Cancel"),
    bool("danger", "Destructive", true),
    pick("icon", "Icon", "none", [
      "none",
      "warning",
      "info",
      "question",
      "check-circle",
    ]),
    num("width", "Width", 320, 220, 560),
  ],
  (_t, v) => {
    const out: Shape[] = [
      R(0, 0, v.width, 176, { r: "card", f: "surface", s: "border" }),
    ];
    const x = v.icon !== "none" ? 56 : 20;
    if (v.icon !== "none") {
      out.push(I(v.icon, 20, 20, 28, v.danger ? "danger" : "accent"));
    }
    out.push(T(v.title, x, 34, 17), T(v.body, 20, 72, 13, "muted"));
    const bw = Math.max(80, tw(v.confirm, 13) + 32);
    const cw = Math.max(80, tw(v.cancel, 13) + 32);
    out.push(
      R(v.width - 20 - bw, 120, bw, 40, {
        r: "ctl",
        f: v.danger ? "danger" : "accent",
        s: null,
      }),
      T(v.confirm, v.width - 20 - bw / 2, 140, 13, "onAccent", "middle"),
      R(v.width - 28 - bw - cw, 120, cw, 40, {
        r: "ctl",
        f: null,
        s: "border",
      }),
      T(v.cancel, v.width - 28 - bw - cw / 2, 140, 13, "text", "middle"),
    );
    return out;
  },
  "modal confirm alert",
);

const sheet = p(
  "sheet",
  "Sheet",
  "Overlays",
  [
    pick("side", "Side", "bottom", ["bottom", "side"]),
    text("title", "Title", "Add to…"),
    text("items", "Items", "Queue, Favourites, New playlist"),
    num("width", "Width", 360, 220, 600),
  ],
  (_t, v) => {
    const items = list(v.items);
    const icons = ["layers", "heart", "folder-plus", "share", "download"];
    const side = v.side === "side";
    const h = 76 + items.length * 40;
    const out: Shape[] = [
      R(
        0,
        0,
        side ? Math.min(v.width, 320) : v.width,
        side ? Math.max(h, 360) : h,
        { r: "card", f: "surface", s: "border" },
      ),
    ];
    if (!side) {
      out.push(R(v.width / 2 - 30, 10, 60, 5, { r: 3, f: "border", s: null }));
    }
    out.push(T(v.title, 20, 44, 16));
    items.forEach((it, k) =>
      out.push(
        I(icons[k % 5], 20, 66 + k * 40, 22, "accent"),
        T(it, 56, 77 + k * 40, 14),
      ),
    );
    return out;
  },
  "bottom sheet drawer panel",
);

const snackbar = p(
  "snackbar",
  "Snackbar",
  "Display",
  [
    text("message", "Message", "Added to your library"),
    text("action", "Action", "Undo"),
    pick("icon", "Icon", "check-circle", [
      "none",
      "check-circle",
      "info",
      "warning",
      "x-circle",
    ]),
    num("width", "Width", 320, 200, 600),
  ],
  (_t, v) => {
    const out: Shape[] = [
      R(0, 0, v.width, 52, { r: "ctl", f: "text", s: null }),
    ];
    let x = 16;
    if (v.icon !== "none") {
      out.push(
        I(v.icon, 14, 14, 24, v.icon === "warning" ? "danger" : "success"),
      );
      x = 50;
    }
    out.push(T(v.message, x, 26, 14, "page"));
    if (v.action) {
      out.push(T(v.action, v.width - 16, 26, 14, "accent", "end"));
    }
    return out;
  },
  "toast notification",
);

const badge = p(
  "badge",
  "Badge",
  "Display",
  [
    text("text", "Text", "local"),
    pick("look", "Look", "pill", ["pill", "dot", "count"]),
    pick("tone", "Tone", "success", ["success", "accent", "danger", "muted"]),
  ],
  (_t, v) => {
    const f = v.tone as Token;
    if (v.look === "dot") {
      return [E(0, 0, 10, 10, { f, s: null })];
    }
    if (v.look === "count") {
      return [
        E(0, 0, 22, 22, { f, s: null }),
        T(v.text.slice(0, 2), 11, 11, 12, "onAccent", "middle"),
      ];
    }
    const w = tw(v.text, 12) + 20;
    return [
      R(0, 0, w, 24, { r: "pill", f, s: null }),
      T(v.text, w / 2, 12, 12, "onAccent", "middle"),
    ];
  },
  "tag label status count",
);

const carousel = p(
  "carousel",
  "Carousel",
  "Display",
  [
    num("items", "Items", 4, 2, 8),
    num("active", "Active (1-based)", 1, 1, 8),
    pick("style", "Style", "multi-browse", [
      "multi-browse",
      "uncontained",
      "hero",
    ]),
    num("height", "Height", 140, 80, 300),
    bool("labels", "Captions", true),
  ],
  (_t, v) => {
    const h = v.height;
    const out: Shape[] = [];
    let x = 0;
    for (let k = 0; k < v.items; k++) {
      const on = v.active === k + 1;
      const w =
        v.style === "hero"
          ? on
            ? h * 2
            : 40
          : v.style === "uncontained"
          ? h * 1.2
          : on
          ? h * 1.6
          : k === v.active
          ? h * 0.9
          : h * 0.5;
      out.push(
        R(x, 0, w, h, {
          r: "card",
          f: on ? "surfaceAlt" : "surface",
          s: "border",
        }),
      );
      if (w > 60) {
        out.push(I("image", x + w / 2 - 14, h / 2 - 14, 28, "muted"));
        if (v.labels) {
          out.push(T(`Item ${k + 1}`, x + 12, h - 16, 12, "text"));
        }
      }
      x += w + 8;
    }
    return out;
  },
  "slider gallery hero",
);

const card = p(
  "card",
  "Card",
  "Display",
  [
    text("title", "Title", "Card title"),
    text("body", "Text", "A short description of the card."),
    pick("look", "Look", "outlined", ["elevated", "outlined", "filled"]),
    bool("media", "Media", true),
    bool("actions", "Actions", false),
    num("width", "Width", 280, 160, 600),
  ],
  (_t, v) => {
    const media = v.media ? 80 : 0;
    const h = media + 84 + (v.actions ? 52 : 0);
    const out: Shape[] = [
      R(0, 0, v.width, h, {
        r: "card",
        f: v.look === "filled" ? "surfaceAlt" : "surface",
        s: v.look === "elevated" ? null : "border",
      }),
    ];
    if (v.look === "elevated") {
      out.push(R(2, 4, v.width, h, { r: "card", f: null, s: "border", sw: 1 }));
    }
    if (v.media) {
      out.push(
        R(0, 0, v.width, media, { r: 0, f: "surfaceAlt", s: null }),
        I("image", v.width / 2 - 14, 26, 28, "muted"),
      );
    }
    out.push(
      T(v.title, 16, media + 24, 16),
      T(v.body, 16, media + 52, 12, "muted"),
    );
    if (v.actions) {
      out.push(
        R(v.width - 96, h - 48, 80, 36, { r: "ctl", f: "accent", s: null }),
        T("Open", v.width - 56, h - 30, 13, "onAccent", "middle"),
      );
    }
    return out;
  },
  "tile panel",
);

const navBar = p(
  "navigation-bar",
  "Navigation bar",
  "Navigation",
  [
    text(
      "items",
      "Items",
      "Home:home, Search:search, Saved:heart, Profile:user",
    ),
    num("active", "Active (1-based)", 1, 1, 6),
    pick("orientation", "Orientation", "bottom", ["bottom", "rail"]),
    pick("indicator", "Indicator", "pill", ["pill", "none"]),
  ],
  (_t, v) => {
    const items = list(v.items).map((s) => s.split(":").map((x) => x.trim()));
    const rail = v.orientation === "rail";
    const out: Shape[] = rail
      ? [
          R(0, 0, 80, 16 + items.length * 76, {
            r: 0,
            f: "surface",
            s: "border",
          }),
        ]
      : [R(0, 0, items.length * 90, 72, { r: 0, f: "surface", s: "border" })];
    items.forEach(([lb, ic], k) => {
      const cx = rail ? 40 : 45 + k * 90;
      const cy = rail ? 44 + k * 76 : 26;
      const on = v.active === k + 1;
      if (on && v.indicator === "pill") {
        out.push(
          R(cx - 32, cy - 16, 64, 32, { r: "pill", f: "surfaceAlt", s: null }),
        );
      }
      out.push(
        I(ic ?? "home", cx - 12, cy - 12, 24, on ? "accent" : "muted"),
        T(lb, cx, cy + 28, 11, on ? "text" : "muted", "middle"),
      );
    });
    return out;
  },
  "bottom nav rail tab bar",
);

const calendar = p(
  "calendar",
  "Calendar",
  "Pickers",
  [
    num("year", "Year", 2026, 1970, 2100),
    num("month", "Month", 9, 1, 12),
    num("selected", "Selected day (0 none)", 17, 0, 31),
    bool("mondayFirst", "Week starts Monday", true),
    bool("today", "Mark today as ring", true),
  ],
  (_t, v) => {
    const names = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const first = new Date(v.year, v.month - 1, 1).getDay();
    const lead = v.mondayFirst ? (first + 6) % 7 : first;
    const days = new Date(v.year, v.month, 0).getDate();
    const weeks = Math.ceil((lead + days) / 7);
    const h = 96 + weeks * 38 + 10;
    const out: Shape[] = [
      R(0, 0, 280, h, { r: "card", f: "surface", s: "border" }),
      I("chevron-left", 14, 14, 20, "muted"),
      T(`${names[v.month - 1]} ${v.year}`, 140, 24, 15, "text", "middle"),
      I("chevron-right", 246, 14, 20, "muted"),
    ];
    (v.mondayFirst
      ? ["M", "T", "W", "T", "F", "S", "S"]
      : ["S", "M", "T", "W", "T", "F", "S"]
    ).forEach((d, k) => out.push(T(d, 20 + k * 40, 56, 12, "muted", "middle")));
    for (let day = 1; day <= days; day++) {
      const n = lead + day - 1;
      const x = 20 + (n % 7) * 40;
      const y = 90 + Math.floor(n / 7) * 38;
      const sel = day === v.selected;
      if (sel) {
        out.push(E(x - 17, y - 17, 34, 34, { f: "accent", s: null }));
      } else if (v.today && day === 3) {
        out.push(E(x - 17, y - 17, 34, 34, { f: null, s: "accent" }));
      }
      out.push(T(String(day), x, y, 13, sel ? "onAccent" : "text", "middle"));
    }
    return out;
  },
  "date picker month",
);

const timePicker = p(
  "time-picker",
  "Time picker",
  "Pickers",
  [
    num("hour", "Hour", 10, 0, 23),
    num("minute", "Minute", 34, 0, 59),
    bool("ampm", "12-hour", false),
    pick("style", "Style", "wheel", ["wheel", "dial"]),
  ],
  (_t, v) => {
    const pad = (n: number) => String(((n % 60) + 60) % 60).padStart(2, "0");
    const hh = (n: number) => (v.ampm ? ((n + 11) % 12) + 1 : n);
    if (v.style === "dial") {
      const out: Shape[] = [
        R(0, 0, 240, 300, { r: "card", f: "surface", s: "border" }),
        R(24, 24, 72, 64, { r: "ctl", f: "accent", s: null }),
        T(pad(hh(v.hour)), 60, 56, 30, "onAccent", "middle"),
        T(":", 108, 54, 28, "text", "middle"),
        R(120, 24, 72, 64, { r: "ctl", f: "surfaceAlt", s: null }),
        T(pad(v.minute), 156, 56, 30, "text", "middle"),
        E(30, 108, 180, 180, { f: "surfaceAlt", s: null }),
        E(116, 194, 8, 8, { f: "accent", s: null }),
      ];
      const a = deg(-90 + (v.hour % 12) * 30);
      out.push(
        L(
          [
            [120, 198],
            [120 + Math.cos(a) * 66, 198 + Math.sin(a) * 66],
          ],
          { s: "accent", sw: 2 },
        ),
        E(120 + Math.cos(a) * 66 - 16, 198 + Math.sin(a) * 66 - 16, 32, 32, {
          f: "accent",
          s: null,
        }),
      );
      return out;
    }
    return [
      R(0, 0, 200, 160, { r: "card", f: "surface", s: "border" }),
      R(14, 62, 172, 36, { r: "ctl", f: "surfaceAlt", s: null }),
      T(pad(hh(v.hour - 1)), 56, 26, 14, "muted", "middle"),
      T(pad(hh(v.hour)), 56, 80, 20, "text", "middle"),
      T(pad(hh(v.hour + 1)), 56, 134, 14, "muted", "middle"),
      T(":", 100, 80, 20, "muted", "middle"),
      T(pad(v.minute - 1), 144, 26, 14, "muted", "middle"),
      T(pad(v.minute), 144, 80, 20, "accent", "middle"),
      T(pad(v.minute + 1), 144, 134, 14, "muted", "middle"),
    ];
  },
  "clock wheel",
);

const fab = p(
  "fab",
  "Floating action button",
  "Buttons",
  [
    pick("size", "Size", "regular", ["small", "regular", "large"]),
    pick("icon", "Icon", "plus", ICON_CHOICES.slice(1)),
    text("label", "Label (extended)", ""),
    pick("look", "Look", "primary", ["primary", "tonal", "surface"]),
    stateParam,
  ],
  (_t, v) => {
    const z = v.size === "small" ? 40 : v.size === "large" ? 96 : 56;
    const base: Record<string, [Token | null, Token | null, Token]> = {
      primary: ["accent", null, "onAccent"],
      tonal: ["surfaceAlt", null, "text"],
      surface: ["surface", "border", "accent"],
    };
    const [f0, s0, i0] = base[v.look] ?? base.primary;
    const k = look(v.state, f0, s0, i0);
    const ext = !!v.label;
    const w = ext ? 40 + 24 + tw(v.label, 14) + 8 : z;
    const r = v.size === "large" ? 28 : 16;
    const isz = v.size === "large" ? 36 : 24;
    return [
      ...(k.ring ? [ring(0, 0, w, z, r)] : []),
      R(0, 0, w, z, { r, f: k.f, s: k.s, sw: k.sw }),
      I(v.icon, ext ? 16 : (z - isz) / 2, (z - isz) / 2, isz, k.ink),
      ...(ext
        ? [
            T(
              v.label,
              16 + 24 + 12 + tw(v.label, 14) / 2,
              z / 2,
              14,
              k.ink,
              "middle",
            ),
          ]
        : []),
    ];
  },
  "fab extended action",
);

const segmentedButtons = p(
  "segmented-buttons",
  "Segmented buttons",
  "Buttons",
  [
    text("labels", "Labels", "Day, Week, Month"),
    num("active", "Selected (1-based, 0 none)", 1, 0, 6),
    bool("checks", "Check on selected", true),
    num("height", "Height", 40, 32, 56),
  ],
  (_t, v) => {
    const labels = list(v.labels);
    const out: Shape[] = [];
    let x = 0;
    labels.forEach((lb, k) => {
      const on = v.active === k + 1;
      const w = tw(lb, 13) + 36 + (on && v.checks ? 22 : 0);
      out.push(
        R(x, 0, w, v.height, {
          r: k === 0 || k === labels.length - 1 ? "pill" : 0,
          f: on ? "surfaceAlt" : null,
          s: "border",
        }),
      );
      if (on && v.checks) {
        out.push(I("check", x + 12, v.height / 2 - 9, 18, "text"));
      }
      out.push(
        T(
          lb,
          x + w / 2 + (on && v.checks ? 10 : 0),
          v.height / 2,
          13,
          "text",
          "middle",
        ),
      );
      x += w;
    });
    return out;
  },
  "segmented toggle group",
);

const drawer = p(
  "drawer",
  "Navigation drawer",
  "Navigation",
  [
    text("title", "Headline", "Mail"),
    text(
      "items",
      "Items",
      "Inbox:home, Outbox:send, Favorites:heart, Trash:trash",
    ),
    num("active", "Active (1-based)", 1, 1, 8),
    num("width", "Width", 300, 200, 420),
  ],
  (_t, v) => {
    const items = list(v.items).map((x) => x.split(":").map((y) => y.trim()));
    const h = 72 + items.length * 56 + 16;
    const out: Shape[] = [
      R(0, 0, v.width, h, { r: "card", f: "surface", s: "border" }),
      T(v.title, 28, 40, 14, "muted"),
    ];
    items.forEach(([lb, ic], k) => {
      const y = 72 + k * 56;
      const on = v.active === k + 1;
      if (on) {
        out.push(
          R(12, y, v.width - 24, 56, { r: "pill", f: "surfaceAlt", s: null }),
        );
      }
      out.push(
        I(ic ?? "home", 28, y + 16, 24, on ? "text" : "muted"),
        T(lb, 64, y + 28, 14, on ? "text" : "muted"),
      );
    });
    return out;
  },
  "side navigation menu",
);

const searchView = p(
  "search-view",
  "Search view",
  "Inputs",
  [
    text("query", "Query", "noodle"),
    num("results", "Results", 3, 0, 6),
    num("width", "Width", 360, 240, 700),
  ],
  (_t, v) => {
    const h = 64 + v.results * 56 + 8;
    const out: Shape[] = [
      R(0, 0, v.width, h, { r: "card", f: "surface", s: "border" }),
      I("arrow-left", 16, 20, 24, "text"),
      T(v.query, 56, 32, 16),
      I("close", v.width - 40, 20, 24, "muted"),
      R(0, 63, v.width, 1, { f: "border", s: null }),
    ];
    for (let k = 0; k < v.results; k++) {
      const y = 64 + k * 56;
      out.push(
        I("clock", 16, y + 16, 24, "muted"),
        T(
          `${v.query} ${
            ["shop", "soup", "recipe", "bar", "house", "guide"][k % 6]
          }`,
          56,
          y + 28,
          14,
        ),
        I("arrow-up", v.width - 40, y + 16, 24, "muted"),
      );
    }
    return out;
  },
  "results suggestions",
);

const datePicker = p(
  "date-picker",
  "Date picker dialog",
  "Pickers",
  [
    num("day", "Day", 17, 1, 28),
    num("month", "Month", 9, 1, 12),
    num("year", "Year", 2026, 1970, 2100),
  ],
  (_t, v) => {
    const names = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(v.year, v.month - 1, v.day).getDay()
    ];
    const first = new Date(v.year, v.month - 1, 1).getDay();
    const lead = (first + 6) % 7;
    const days = new Date(v.year, v.month, 0).getDate();
    const weeks = Math.ceil((lead + days) / 7);
    const h = 120 + 40 + weeks * 40 + 64;
    const out: Shape[] = [
      R(0, 0, 328, h, { r: "card", f: "surface", s: "border" }),
      T("Select date", 24, 28, 12, "muted"),
      T(`${wd}, ${names[v.month - 1]} ${v.day}`, 24, 68, 28),
      I("pencil", 280, 52, 24, "muted"),
      R(0, 100, 328, 1, { f: "border", s: null }),
      T(`${names[v.month - 1]} ${v.year}`, 24, 124, 14),
      I("chevron-left", 252, 112, 24, "muted"),
      I("chevron-right", 284, 112, 24, "muted"),
    ];
    ["M", "T", "W", "T", "F", "S", "S"].forEach((d, k) =>
      out.push(T(d, 36 + k * 40, 160, 12, "muted", "middle")),
    );
    for (let day = 1; day <= days; day++) {
      const n = lead + day - 1;
      const x = 36 + (n % 7) * 40;
      const y = 196 + Math.floor(n / 7) * 40;
      if (day === v.day) {
        out.push(E(x - 18, y - 18, 36, 36, { f: "accent", s: null }));
      }
      out.push(
        T(String(day), x, y, 13, day === v.day ? "onAccent" : "text", "middle"),
      );
    }
    const by = h - 52;
    out.push(
      T("Cancel", 220, by + 20, 14, "accent", "middle"),
      T("OK", 290, by + 20, 14, "accent", "middle"),
    );
    return out;
  },
  "modal calendar",
);

const tooltip = p(
  "tooltip",
  "Tooltip",
  "Display",
  [
    pick("kind", "Kind", "plain", ["plain", "rich"]),
    text("text", "Text", "Add to queue"),
    text("title", "Title (rich)", "Queue"),
    text("action", "Action (rich)", "Learn more"),
  ],
  (_t, v) => {
    if (v.kind === "rich") {
      const w = Math.max(200, tw(v.text, 12) + 32);
      return [
        R(0, 0, w, 112, { r: 12, f: "surface", s: "border" }),
        T(v.title, 16, 24, 14, "text"),
        T(v.text, 16, 52, 12, "muted"),
        T(v.action, 16, 90, 13, "accent"),
      ];
    }
    const w = tw(v.text, 12) + 24;
    return [
      R(0, 0, w, 28, { r: 6, f: "text", s: null }),
      T(v.text, w / 2, 14, 12, "page", "middle"),
    ];
  },
  "hint help",
);

const scaffold = p(
  "scaffold",
  "App screen",
  "Screens",
  [
    text("title", "Title", "My app"),
    num("rows", "List rows", 5, 0, 8),
    bool("fab", "Floating button", true),
    bool("bottomBar", "Navigation bar", true),
    pick("bar", "Top bar", "small", ["small", "center", "medium", "large"]),
  ],
  (th, v) => {
    const out: Shape[] = [
      R(0, 0, 360, 720, { r: 36, f: "page", s: "border", sw: 2 }),
    ];
    const bar = appBar.shapes(th, {
      ...defaultsOf(appBar),
      title: v.title,
      size: v.bar,
      actions: 2,
      width: 360,
    });
    out.push(...bar);
    const top = v.bar === "large" ? 160 : v.bar === "medium" ? 120 : 64;
    out.push(
      ...offset(
        rows.shapes(th, {
          ...defaultsOf(rows),
          rows: v.rows,
          width: 336,
          leading: "status",
          trailing: "actions",
          style: "cards",
        }),
        12,
        top,
      ),
    );
    if (v.bottomBar) {
      out.push(
        ...offset(
          navBar
            .shapes(th, {
              ...defaultsOf(navBar),
              items: "Home:home, Search:search, Saved:heart, Profile:user",
            })
            .map((s) => widen(s, 360)),
          0,
          648,
        ),
      );
    }
    if (v.fab) {
      out.push(
        ...offset(
          fab.shapes(th, { ...defaultsOf(fab), size: "regular" }),
          280,
          v.bottomBar ? 568 : 640,
        ),
      );
    }
    return out;
  },
  "phone layout mobile page",
);

const widen = (s: Shape, w: number): Shape =>
  s.t === "rect" && s.x === 0 && s.y === 0 && s.h === 72 ? { ...s, w } : s;

const offset = (shapes: Shape[], dx: number, dy: number): Shape[] =>
  shapes.map((s) =>
    s.t === "line"
      ? {
          ...s,
          pts: s.pts.map(([x, y]) => [x + dx, y + dy] as [number, number]),
        }
      : ({ ...s, x: (s as any).x + dx, y: (s as any).y + dy } as Shape),
  );

export const PARAMETRIC: readonly ComponentDef[] = [
  scaffold,
  fab,
  segmentedButtons,
  drawer,
  searchView,
  datePicker,
  tooltip,
  button,
  iconButton,
  iconButtons,
  toggle,
  checkbox,
  radio,
  slider,
  knob,
  stepper,
  rating,
  input,
  searchBar,
  select,
  pills,
  badge,
  progress,
  snackbar,
  card,
  carousel,
  accordion,
  rows,
  table,
  tabs,
  appBar,
  navBar,
  pagination,
  steps,
  menu,
  dialog,
  sheet,
  calendar,
  timePicker,
];

/** the fixed components these replace */
export const REPLACED = new Set([
  "button-primary",
  "button-secondary",
  "button-ghost",
  "button-danger",
  "button-icon",
  "button-icon-soft",
  "button-group",
  "checkbox-on",
  "checkbox-off",
  "radio-on",
  "radio-off",
  "toggle-on",
  "toggle-off",
  "slider",
  "slider-range",
  "slider-labeled",
  "knob",
  "knob-small",
  "stepper",
  "rating",
  "chips",
  "tabs",
  "segmented",
  "pagination",
  "steps",
  "list-simple",
  "list-switch",
  "table",
  "navbar",
  "bottom-nav",
  "calendar",
  "time-picker",
  "menu",
  "dialog",
  "sheet",
  "toast",
  "badge",
  "badge-count",
  "progress",
  "progress-labeled",
  "progress-ring",
  "tooltip",
  "input-text",
  "input-search",
  "input-password",
  "input-labeled",
  "input-error",
  "input-select",
  "card",
]);

export type { Values };
