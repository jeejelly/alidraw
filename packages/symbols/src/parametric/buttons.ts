import {
  iconShape,
  defineParametric,
  rectShape,
  textShape,
  type Shape,
} from "../shapes";

import {
  stateParam,
  num,
  bool,
  text,
  pick,
  ICON_CHOICES,
  tw,
  list,
  look,
  ring,
} from "./helpers";

import type { Token } from "../theme";

export const button = defineParametric(
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
  (_t, values) => {
    const width = values.width;
    const base: Record<string, [Token | null, Token | null, Token]> = {
      primary: ["accent", null, "onAccent"],
      tonal: ["surfaceAlt", null, "text"],
      elevated: ["surface", "border", "accent"],
      secondary: ["surfaceAlt", "border", "text"],
      outline: [null, "accent", "accent"],
      danger: ["danger", null, "onAccent"],
      text: [null, null, "accent"],
    };
    const [f0, s0, i0] = base[values.look] ?? base.primary;
    const stateStyle = look(values.state, f0, s0, i0);
    const out: Shape[] = [];
    if (stateStyle.ring) {
      out.push(ring(0, 0, width, 40, "ctl"));
    }
    out.push(
      rectShape(0, 0, width, 40, {
        r: "ctl",
        f: stateStyle.f,
        s: stateStyle.s,
        sw: stateStyle.sw,
      }),
    );
    const hasIcon = values.icon !== "none";
    const lw = tw(values.label, 14);
    const total = lw + (hasIcon ? 28 : 0);
    const x0 = (width - total) / 2;
    if (hasIcon) {
      out.push(iconShape(values.icon, x0, 10, 20, stateStyle.ink));
    }
    out.push(
      textShape(
        values.label,
        x0 + (hasIcon ? 28 : 0) + lw / 2,
        20,
        14,
        stateStyle.ink,
        "middle",
      ),
    );
    return out;
  },
  "cta action submit",
);

export const iconButton = defineParametric(
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
  (_t, values) => {
    const z = values.size;
    const base: Record<string, [Token | null, Token | null, Token]> = {
      filled: ["accent", null, "onAccent"],
      soft: ["surfaceAlt", null, "accent"],
      outline: [null, "border", "text"],
      plain: [null, null, "text"],
    };
    const [f0, s0, i0] = base[values.look] ?? base.filled;
    const stateStyle = look(values.state, f0, s0, i0);
    const radiusKind = values.round ? "pill" : "ctl";
    return [
      ...(stateStyle.ring ? [ring(0, 0, z, z, radiusKind)] : []),
      rectShape(0, 0, z, z, {
        r: radiusKind,
        f: stateStyle.f,
        s: stateStyle.s,
        sw: stateStyle.sw,
      }),
      iconShape(values.icon, z * 0.25, z * 0.25, z * 0.5, stateStyle.ink),
    ];
  },
  "pill round play",
);

export const iconButtons = defineParametric(
  "icon-buttons",
  "Icon button row",
  "Buttons",
  [
    text("icons", "Icons", "play,layers,download"),
    pick("look", "Look", "filled", ["filled", "soft", "outline"]),
    num("size", "Size", 40, 28, 64),
    num("gap", "Gap", 8, 0, 24),
  ],
  (_t, values) =>
    list(values.icons).flatMap((ic, index): Shape[] => {
      const x = index * (values.size + values.gap);
      const [f0, s0, i0]: [Token | null, Token | null, Token] =
        values.look === "soft"
          ? ["surfaceAlt", null, "accent"]
          : values.look === "outline"
          ? [null, "border", "text"]
          : ["accent", null, "onAccent"];
      return [
        rectShape(x, 0, values.size, values.size, { r: "pill", f: f0, s: s0 }),
        iconShape(
          ic,
          x + values.size * 0.25,
          values.size * 0.25,
          values.size * 0.5,
          i0,
        ),
      ];
    }),
  "actions toolbar",
);

export const fab = defineParametric(
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
  (_t, values) => {
    const z = values.size === "small" ? 40 : values.size === "large" ? 96 : 56;
    const base: Record<string, [Token | null, Token | null, Token]> = {
      primary: ["accent", null, "onAccent"],
      tonal: ["surfaceAlt", null, "text"],
      surface: ["surface", "border", "accent"],
    };
    const [f0, s0, i0] = base[values.look] ?? base.primary;
    const stateStyle = look(values.state, f0, s0, i0);
    const ext = !!values.label;
    const width = ext ? 40 + 24 + tw(values.label, 14) + 8 : z;
    const radius = values.size === "large" ? 28 : 16;
    const isz = values.size === "large" ? 36 : 24;
    return [
      ...(stateStyle.ring ? [ring(0, 0, width, z, radius)] : []),
      rectShape(0, 0, width, z, {
        r: radius,
        f: stateStyle.f,
        s: stateStyle.s,
        sw: stateStyle.sw,
      }),
      iconShape(
        values.icon,
        ext ? 16 : (z - isz) / 2,
        (z - isz) / 2,
        isz,
        stateStyle.ink,
      ),
      ...(ext
        ? [
            textShape(
              values.label,
              16 + 24 + 12 + tw(values.label, 14) / 2,
              z / 2,
              14,
              stateStyle.ink,
              "middle",
            ),
          ]
        : []),
    ];
  },
  "fab extended action",
);

export const segmentedButtons = defineParametric(
  "segmented-buttons",
  "Segmented buttons",
  "Buttons",
  [
    text("labels", "Labels", "Day, Week, Month"),
    num("active", "Selected (1-based, 0 none)", 1, 0, 6),
    bool("checks", "Check on selected", true),
    num("height", "Height", 40, 32, 56),
  ],
  (_t, values) => {
    const labels = list(values.labels);
    const out: Shape[] = [];
    let x = 0;
    labels.forEach((lb, index) => {
      const on = values.active === index + 1;
      const width = tw(lb, 13) + 36 + (on && values.checks ? 22 : 0);
      out.push(
        rectShape(x, 0, width, values.height, {
          r: index === 0 || index === labels.length - 1 ? "pill" : 0,
          f: on ? "surfaceAlt" : null,
          s: "border",
        }),
      );
      if (on && values.checks) {
        out.push(iconShape("check", x + 12, values.height / 2 - 9, 18, "text"));
      }
      out.push(
        textShape(
          lb,
          x + width / 2 + (on && values.checks ? 10 : 0),
          values.height / 2,
          13,
          "text",
          "middle",
        ),
      );
      x += width;
    });
    return out;
  },
  "segmented toggle group",
);
