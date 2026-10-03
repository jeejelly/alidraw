import {
  ellipseShape,
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
  list,
  look,
  ring,
} from "./helpers";

import type { Token } from "../theme";

export const searchBar = defineParametric(
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
  (_t, values) => {
    const stateStyle = look(values.state, "surfaceAlt", null, "text");
    const out: Shape[] = [];
    if (stateStyle.ring) {
      out.push(ring(0, 0, values.width, 48, "pill"));
    }
    out.push(
      rectShape(0, 0, values.width, 48, {
        r: "pill",
        f: stateStyle.f,
        s: stateStyle.s,
        sw: stateStyle.sw,
      }),
      iconShape(values.leading, 14, 12, 24, "muted"),
      textShape(
        values.placeholder,
        50,
        24,
        14,
        values.filled ? stateStyle.ink : "muted",
      ),
    );
    if (values.avatar) {
      out.push(
        ellipseShape(values.width - 42, 8, 32, 32, { f: "accent", s: null }),
        textShape("A", values.width - 26, 24, 13, "onAccent", "middle"),
      );
    } else if (values.filled) {
      out.push(iconShape("close", values.width - 38, 12, 24, "muted"));
    }
    return out;
  },
  "field query",
);

export const input = defineParametric(
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
  (_t, values) => {
    const top = values.label ? 22 : 0;
    const edge: Token | null = values.error
      ? "danger"
      : values.state === "focus"
      ? "accent"
      : values.style === "filled"
      ? null
      : "border";
    const stateStyle = look(
      values.state === "focus" ? "enabled" : values.state,
      values.style === "filled" ? "surfaceAlt" : "surface",
      edge,
      "text",
    );
    const out: Shape[] = [];
    if (values.label) {
      out.push(
        textShape(values.label, 0, 8, 12, values.error ? "danger" : "muted"),
      );
    }
    out.push(
      rectShape(0, top, values.width, 44, {
        r: "ctl",
        f: stateStyle.f,
        s: stateStyle.s,
        sw: values.state === "focus" ? 2 : stateStyle.sw,
      }),
    );
    let x = 14;
    if (values.icon !== "none") {
      out.push(iconShape(values.icon, 12, top + 12, 20, "muted"));
      x = 42;
    }
    out.push(
      textShape(
        values.value || "Placeholder",
        x,
        top + 22,
        14,
        values.value ? stateStyle.ink : "muted",
      ),
    );
    if (values.trailing !== "none") {
      out.push(
        iconShape(values.trailing, values.width - 32, top + 12, 20, "muted"),
      );
    }
    if (values.helper) {
      out.push(
        textShape(
          values.helper,
          0,
          top + 58,
          12,
          values.error ? "danger" : "muted",
        ),
      );
    }
    return out;
  },
  "textbox form",
);

export const select = defineParametric(
  "select",
  "Select",
  "Inputs",
  [
    text("value", "Value", "Choose one"),
    bool("open", "Open", false),
    text("options", "Options", "All, Saved, Recent"),
    num("width", "Width", 220, 120, 500),
  ],
  (_t, values) => {
    const out: Shape[] = [
      rectShape(0, 0, values.width, 44, {
        r: "ctl",
        f: "surface",
        s: values.open ? "accent" : "border",
        sw: values.open ? 2 : 1,
      }),
      textShape(
        values.value,
        14,
        22,
        14,
        values.value === "Choose one" ? "muted" : "text",
      ),
      iconShape(
        values.open ? "chevron-up" : "chevron-down",
        values.width - 32,
        12,
        20,
        "muted",
      ),
    ];
    if (values.open) {
      const opts = list(values.options);
      out.push(
        rectShape(0, 50, values.width, opts.length * 40 + 8, {
          r: "ctl",
          f: "surface",
          s: "border",
        }),
      );
      opts.forEach((option, index) =>
        out.push(
          textShape(
            option,
            14,
            74 + index * 40 - 4,
            14,
            index === 0 ? "accent" : "text",
          ),
        ),
      );
    }
    return out;
  },
  "dropdown combo",
);

export const searchView = defineParametric(
  "search-view",
  "Search view",
  "Inputs",
  [
    text("query", "Query", "noodle"),
    num("results", "Results", 3, 0, 6),
    num("width", "Width", 360, 240, 700),
  ],
  (_t, values) => {
    const height = 64 + values.results * 56 + 8;
    const out: Shape[] = [
      rectShape(0, 0, values.width, height, {
        r: "card",
        f: "surface",
        s: "border",
      }),
      iconShape("arrow-left", 16, 20, 24, "text"),
      textShape(values.query, 56, 32, 16),
      iconShape("close", values.width - 40, 20, 24, "muted"),
      rectShape(0, 63, values.width, 1, { f: "border", s: null }),
    ];
    for (let index = 0; index < values.results; index++) {
      const y = 64 + index * 56;
      out.push(
        iconShape("clock", 16, y + 16, 24, "muted"),
        textShape(
          `${values.query} ${
            ["shop", "soup", "recipe", "bar", "house", "guide"][index % 6]
          }`,
          56,
          y + 28,
          14,
        ),
        iconShape("arrow-up", values.width - 40, y + 16, 24, "muted"),
      );
    }
    return out;
  },
  "results suggestions",
);
