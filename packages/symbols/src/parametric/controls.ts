import {
  arcPts,
  deg,
  ellipseShape,
  iconShape,
  lineShape,
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
  tw,
  list,
  look,
  ring,
} from "./helpers";

import type { Token } from "../theme";

export const toggle = defineParametric(
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
  (_t, values) => {
    const height = values.size;
    const width = Math.round(height * 1.72);
    const stateStyle = look(
      values.state,
      values.on ? "accent" : "surfaceAlt",
      values.on ? "accent" : "border",
      values.on ? "onAccent" : "muted",
    );
    const inset = height - 8;
    const out: Shape[] = [];
    if (stateStyle.ring) {
      out.push(ring(0, 0, width, height, "pill"));
    }
    out.push(
      rectShape(0, 0, width, height, {
        r: "pill",
        f: stateStyle.f,
        s: stateStyle.s,
        sw: stateStyle.sw,
      }),
      ellipseShape(values.on ? width - 4 - inset : 4, 4, inset, inset, {
        f: stateStyle.ink,
        s: null,
      }),
    );
    if (values.icon) {
      out.push(
        iconShape(
          values.on ? "check" : "close",
          (values.on ? width - 4 - inset : 4) + inset * 0.2,
          4 + inset * 0.2,
          inset * 0.6,
          values.on ? "accent" : "surface",
        ),
      );
    }
    if (values.label) {
      out.push(
        textShape(
          values.label,
          width + 12,
          height / 2,
          14,
          values.state === "disabled" ? "muted" : "text",
        ),
      );
    }
    return out;
  },
  "switch on off",
);

export const checkbox = defineParametric(
  "checkbox",
  "Checkbox",
  "Inputs",
  [
    pick("value", "Value", "checked", ["checked", "unchecked", "mixed"]),
    text("label", "Label", "Remember me"),
    stateParam,
  ],
  (_t, values) => {
    const on = values.value !== "unchecked";
    const stateStyle = look(
      values.state,
      on ? "accent" : "surface",
      on ? "accent" : "border",
      "onAccent",
    );
    return [
      ...(stateStyle.ring ? [ring(0, 2, 20, 20, 6)] : []),
      rectShape(0, 2, 20, 20, {
        r: 5,
        f: stateStyle.f,
        s: stateStyle.s,
        sw: stateStyle.sw,
      }),
      ...(values.value === "checked"
        ? [
            lineShape(
              [
                [5, 12],
                [9, 16],
                [16, 8],
              ],
              { s: stateStyle.ink, sw: 2 },
            ),
          ]
        : values.value === "mixed"
        ? [
            lineShape(
              [
                [5, 12],
                [15, 12],
              ],
              { s: stateStyle.ink, sw: 2 },
            ),
          ]
        : []),
      ...(values.label
        ? [
            textShape(
              values.label,
              30,
              12,
              14,
              values.state === "disabled" ? "muted" : "text",
            ),
          ]
        : []),
    ];
  },
  "check tick",
);

export const radio = defineParametric(
  "radio",
  "Radio",
  "Inputs",
  [bool("on", "Selected", true), text("label", "Label", "Option"), stateParam],
  (_t, values) => {
    const stateStyle = look(
      values.state,
      "surface",
      values.on ? "accent" : "border",
      "accent",
    );
    return [
      ...(stateStyle.ring
        ? [ellipseShape(-4, -2, 28, 28, { f: null, s: "accent", sw: 2 })]
        : []),
      ellipseShape(0, 2, 20, 20, {
        f: stateStyle.f,
        s: stateStyle.s,
        sw: stateStyle.sw,
      }),
      ...(values.on
        ? [ellipseShape(5, 7, 10, 10, { f: stateStyle.ink, s: null })]
        : []),
      ...(values.label
        ? [
            textShape(
              values.label,
              30,
              12,
              14,
              values.state === "disabled" ? "muted" : "text",
            ),
          ]
        : []),
    ];
  },
);

export const pills = defineParametric(
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
  (_t, values) => {
    const out: Shape[] = [];
    let x = 0;
    let y = 0;
    list(values.labels).forEach((lb, index) => {
      const lead =
        values.kind === "assist" ||
        (values.kind === "filter" && values.active === index + 1)
          ? 22
          : 0;
      const width =
        tw(lb, 13) +
        28 +
        lead +
        (values.close || values.kind === "input" ? 20 : 0);
      if (values.wrap && x > 0 && x + width > values.width) {
        x = 0;
        y += 42;
      }
      const on = values.active === index + 1;
      const base: [Token | null, Token | null, Token] =
        on && values.look !== "outline"
          ? ["accent", null, "onAccent"]
          : values.look === "outline"
          ? [
              on ? "surfaceAlt" : null,
              on ? "accent" : "border",
              on ? "accent" : "text",
            ]
          : ["surfaceAlt", null, "accent"];
      const kk = look(on ? values.state : "enabled", ...base);
      out.push(
        rectShape(x, y, width, 34, {
          r: values.kind === "plain" ? "pill" : 8,
          f: kk.f,
          s: kk.s,
          sw: kk.sw,
        }),
        textShape(
          lb,
          x + 14 + lead + tw(lb, 13) / 2,
          y + 17,
          13,
          kk.ink,
          "middle",
        ),
      );
      if (lead) {
        out.push(
          iconShape(
            values.kind === "assist" ? "star" : "check",
            x + 8,
            y + 9,
            16,
            kk.ink,
          ),
        );
      }
      if (values.close || values.kind === "input") {
        out.push(iconShape("close", x + width - 26, y + 9, 16, kk.ink));
      }
      x += width + 8;
    });
    return out;
  },
  "chips filter tags pills",
);

export const slider = defineParametric(
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
  (_t, values) => {
    const width = values.width;
    const top =
      (values.label || values.showValue ? 26 : 0) + (values.bubble ? 30 : 0);
    const cy = top + 12;
    const x1 = (width * (values.range ? values.from : 0)) / 100;
    const x2 = (width * values.value) / 100;
    const stateStyle = look(values.state, "onAccent", "accent", "accent");
    const out: Shape[] = [];
    if (values.label) {
      out.push(textShape(values.label, 0, 8, 13, "muted"));
    }
    if (values.showValue) {
      out.push(textShape(String(values.value), width, 8, 13, "text", "end"));
    }
    out.push(
      rectShape(0, cy - 2, width, 4, { r: "pill", f: "surfaceAlt", s: null }),
      rectShape(Math.min(x1, x2), cy - 2, Math.abs(x2 - x1), 4, {
        r: "pill",
        f: values.state === "disabled" ? "border" : "accent",
        s: null,
      }),
    );
    for (let step = 0; values.steps > 0 && step <= values.steps; step++) {
      out.push(
        ellipseShape((width * step) / values.steps - 2, cy - 2, 4, 4, {
          f: (step / values.steps) * 100 <= values.value ? "onAccent" : "muted",
          s: null,
        }),
      );
    }
    const thumb = (x: number) => {
      if (stateStyle.ring) {
        out.push(
          ellipseShape(x - 14, cy - 14, 28, 28, {
            f: null,
            s: "accent",
            sw: 2,
          }),
        );
      }
      out.push(
        ellipseShape(x - 10, cy - 10, 20, 20, {
          f: stateStyle.f,
          s: stateStyle.s,
          sw: 2,
        }),
      );
    };
    if (values.range) {
      thumb(x1);
    }
    thumb(x2);
    if (values.bubble) {
      out.push(
        rectShape(x2 - 18, cy - 46, 36, 28, { r: "pill", f: "text", s: null }),
        textShape(String(values.value), x2, cy - 32, 12, "page", "middle"),
      );
    }
    return out;
  },
  "range volume track thumb",
);

export const knob = defineParametric(
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
  (_t, values) => {
    const z = values.size;
    const cx = z / 2 + 10;
    const cy = z / 2 + 10;
    const angle = deg(135 + (values.value / 100) * 270);
    const stateStyle = look(values.state, "surfaceAlt", "border", "accent");
    const out: Shape[] = [
      lineShape(arcPts(cx, cy, z / 2 + 6, deg(135), deg(405)), {
        s: "surfaceAlt",
        sw: 4,
      }),
      lineShape(arcPts(cx, cy, z / 2 + 6, deg(135), angle, 20), {
        s: values.state === "disabled" ? "border" : "accent",
        sw: 4,
      }),
      ...(stateStyle.ring
        ? [ellipseShape(6, 6, z + 8, z + 8, { f: null, s: "accent", sw: 2 })]
        : []),
      ellipseShape(10, 10, z, z, {
        f: stateStyle.f,
        s: stateStyle.s,
        sw: stateStyle.sw,
      }),
      lineShape(
        [
          [
            cx + Math.cos(angle) * (z * 0.18),
            cy + Math.sin(angle) * (z * 0.18),
          ],
          [
            cx + Math.cos(angle) * (z * 0.42),
            cy + Math.sin(angle) * (z * 0.42),
          ],
        ],
        { s: stateStyle.ink, sw: 3 },
      ),
    ];
    if (values.ticks) {
      for (let tick = 0; tick <= 10; tick++) {
        const ta = deg(135 + tick * 27);
        const r1 = z / 2 + 14;
        const r2 = z / 2 + 18;
        out.push(
          lineShape(
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
    if (values.label) {
      out.push(textShape(values.label, cx, bottom, 12, "muted", "middle"));
    }
    if (values.showValue) {
      out.push(
        textShape(String(values.value), cx, bottom + 16, 12, "text", "middle"),
      );
    }
    return out;
  },
  "dial rotary potentiometer",
);

export const stepper = defineParametric(
  "stepper",
  "Number stepper",
  "Inputs",
  [
    num("value", "Value", 3, 0, 999),
    pick("style", "Style", "inline", ["inline", "split"]),
  ],
  (_t, values) =>
    values.style === "split"
      ? [
          rectShape(0, 0, 40, 40, { r: "pill", f: "surfaceAlt", s: null }),
          iconShape("minus", 10, 10, 20, "accent"),
          textShape(String(values.value), 70, 20, 16, "text", "middle"),
          rectShape(100, 0, 40, 40, { r: "pill", f: "accent", s: null }),
          iconShape("plus", 110, 10, 20, "onAccent"),
        ]
      : [
          rectShape(0, 0, 132, 40, { r: "ctl", f: "surface", s: "border" }),
          iconShape("minus", 8, 10, 20, "muted"),
          textShape(String(values.value), 66, 20, 15, "text", "middle"),
          iconShape("plus", 104, 10, 20, "muted"),
        ],
  "quantity counter",
);

export const rating = defineParametric(
  "rating",
  "Rating",
  "Inputs",
  [
    num("value", "Value", 4, 0, 10),
    num("max", "Stars", 5, 1, 10),
    num("size", "Size", 24, 12, 48),
  ],
  (_t, values) =>
    Array.from({ length: values.max }, (_, index) =>
      iconShape(
        "star",
        index * (values.size + 2),
        0,
        values.size,
        index < values.value ? "accent" : "border",
      ),
    ),
  "stars review",
);

export const progress = defineParametric(
  "progress",
  "Progress",
  "Display",
  [
    num("value", "Value %", 62, 0, 100),
    pick("style", "Style", "bar", ["bar", "ring", "segments"]),
    bool("label", "Show value", true),
    num("width", "Size", 240, 40, 600),
  ],
  (_t, values) => {
    const width = values.width;
    const out: Shape[] = [];
    if (values.style === "ring") {
      const radius = width / 2 - 6;
      out.push(
        lineShape(arcPts(width / 2, width / 2, radius, 0, Math.PI * 2, 40), {
          s: "surfaceAlt",
          sw: 6,
        }),
        lineShape(
          arcPts(
            width / 2,
            width / 2,
            radius,
            -Math.PI / 2,
            -Math.PI / 2 + (values.value / 100) * Math.PI * 2,
            36,
          ),
          { s: "accent", sw: 6 },
        ),
      );
      if (values.label) {
        out.push(
          textShape(
            `${values.value}%`,
            width / 2,
            width / 2,
            Math.max(11, width / 5),
            "text",
            "middle",
          ),
        );
      }
    } else if (values.style === "segments") {
      const tickCount = 10;
      const gap = 4;
      const sw = (width - gap * (tickCount - 1)) / tickCount;
      for (let index = 0; index < tickCount; index++) {
        out.push(
          rectShape(index * (sw + gap), 0, sw, 8, {
            r: 3,
            f:
              index < Math.round((values.value / 100) * tickCount)
                ? "accent"
                : "surfaceAlt",
            s: null,
          }),
        );
      }
      if (values.label) {
        out.push(textShape(`${values.value}%`, width, 24, 12, "muted", "end"));
      }
    } else {
      out.push(
        rectShape(0, 0, width, 8, { r: "pill", f: "surfaceAlt", s: null }),
        rectShape(0, 0, Math.max(8, (width * values.value) / 100), 8, {
          r: "pill",
          f: "accent",
          s: null,
        }),
      );
      if (values.label) {
        out.push(textShape(`${values.value}%`, width, 24, 12, "muted", "end"));
      }
    }
    return out;
  },
  "loading bar ring circular",
);
