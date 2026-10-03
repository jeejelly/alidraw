import {
  ellipseShape,
  iconShape,
  lineShape,
  defineParametric,
  rectShape,
  textShape,
  type Shape,
} from "../shapes";

import { num, bool, text, pick, tw, list } from "./helpers";

import type { Token } from "../theme";

export const tabs = defineParametric(
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
  (_t, values) => {
    const labels = list(values.labels);
    const natural = labels.map(
      (label) => tw(label, 14) + 40 + (values.icon !== "none" ? 24 : 0),
    );
    const total =
      values.width || natural.reduce((first, second) => first + second, 0);
    const cell = values.width ? values.width / labels.length : 0;
    const widths = natural.map((naturalWidth) => cell || naturalWidth);
    const out: Shape[] = [];
    const sum = widths.reduce((subtotal, width) => subtotal + width, 0);
    if (values.style === "segmented") {
      out.push(
        rectShape(0, 0, sum + 8, 40, { r: "ctl", f: "surfaceAlt", s: null }),
      );
    } else if (values.style === "underline") {
      out.push(rectShape(0, 43, total, 1, { f: "border", s: null }));
    } else if (values.style === "boxed") {
      out.push(rectShape(0, 43, total, 1, { f: "border", s: null }));
    }
    let x = values.style === "segmented" ? 4 : 0;
    labels.forEach((lb, index) => {
      const width = widths[index];
      const on = values.active === index + 1;
      if (on) {
        if (values.style === "underline") {
          out.push(
            rectShape(x + 8, 40, width - 16, 3, { r: 1, f: "accent", s: null }),
          );
        } else if (values.style === "pill") {
          out.push(
            rectShape(x, 4, width, 36, { r: "pill", f: "accent", s: null }),
          );
        } else if (values.style === "segmented") {
          out.push(
            rectShape(x, 0, width, 32, { r: "ctl", f: "surface", s: "border" }),
          );
        } else {
          out.push(
            rectShape(x, 0, width, 44, { r: 0, f: "surface", s: "border" }),
          );
        }
      }
      const ink: Token = on
        ? values.style === "pill"
          ? "onAccent"
          : values.style === "underline"
          ? "accent"
          : "text"
        : "muted";
      const cy =
        values.style === "segmented" ? 16 : values.style === "pill" ? 22 : 20;
      const ic = values.icon !== "none";
      const tx = x + width / 2 + (ic ? 12 : 0);
      if (ic) {
        out.push(
          iconShape(values.icon, tx - tw(lb, 14) / 2 - 24, cy - 10, 20, ink),
        );
      }
      out.push(textShape(lb, tx, cy, 14, ink, "middle"));
      x += width;
    });
    return out;
  },
  "segmented control navigation",
);

export const appBar = defineParametric(
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
  (_t, values) => {
    const big = values.size === "large" || values.size === "medium";
    const height =
      values.size === "large" ? 152 : values.size === "medium" ? 112 : 56;
    const bg: Token = values.look === "accent" ? "accent" : "surface";
    const ink: Token = values.look === "accent" ? "onAccent" : "text";
    const out: Shape[] = [
      rectShape(0, 0, values.width, height, { r: 0, f: bg, s: null }),
    ];
    if (values.leading !== "none") {
      out.push(iconShape(values.leading, 14, 16, 24, ink));
    }
    const icons = ["download", "folder-plus", "search", "more-vertical"];
    for (let action = 0; action < values.actions; action++) {
      const x = values.width - 52 - action * 44;
      if (values.look === "surface") {
        out.push(
          rectShape(x, 8, 40, 40, { r: "pill", f: "accent", s: null }),
          iconShape(icons[action], x + 10, 18, 20, "onAccent"),
        );
      } else {
        out.push(iconShape(icons[action], x + 8, 16, 24, ink));
      }
    }
    if (values.size === "center") {
      out.push(
        textShape(values.title, values.width / 2, 28, 18, ink, "middle"),
      );
    } else if (big) {
      out.push(
        textShape(
          values.title,
          16,
          height - 28,
          values.size === "large" ? 28 : 24,
          ink,
        ),
      );
    } else {
      out.push(
        textShape(
          values.title,
          values.leading === "none" ? 16 : 56,
          28,
          18,
          ink,
        ),
      );
    }
    return out;
  },
  "header toolbar top bar",
);

export const navBar = defineParametric(
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
  (_t, values) => {
    const items = list(values.items).map((entry) =>
      entry.split(":").map((x) => x.trim()),
    );
    const rail = values.orientation === "rail";
    const out: Shape[] = rail
      ? [
          rectShape(0, 0, 80, 16 + items.length * 76, {
            r: 0,
            f: "surface",
            s: "border",
          }),
        ]
      : [
          rectShape(0, 0, items.length * 90, 72, {
            r: 0,
            f: "surface",
            s: "border",
          }),
        ];
    items.forEach(([lb, ic], index) => {
      const cx = rail ? 40 : 45 + index * 90;
      const cy = rail ? 44 + index * 76 : 26;
      const on = values.active === index + 1;
      if (on && values.indicator === "pill") {
        out.push(
          rectShape(cx - 32, cy - 16, 64, 32, {
            r: "pill",
            f: "surfaceAlt",
            s: null,
          }),
        );
      }
      out.push(
        iconShape(ic ?? "home", cx - 12, cy - 12, 24, on ? "accent" : "muted"),
        textShape(lb, cx, cy + 28, 11, on ? "text" : "muted", "middle"),
      );
    });
    return out;
  },
  "bottom nav rail tab bar",
);

export const pagination = defineParametric(
  "pagination",
  "Pagination",
  "Navigation",
  [num("pages", "Pages", 5, 2, 9), num("current", "Current", 1, 1, 9)],
  (_t, values) => {
    const out: Shape[] = [
      rectShape(0, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
      iconShape("chevron-left", 8, 8, 20, "muted"),
    ];
    for (let index = 1; index <= values.pages; index++) {
      const x = index * 44;
      const on = index === values.current;
      out.push(
        rectShape(x, 0, 36, 36, {
          r: "ctl",
          f: on ? "accent" : "surface",
          s: on ? null : "border",
        }),
        textShape(
          String(index),
          x + 18,
          18,
          13,
          on ? "onAccent" : "text",
          "middle",
        ),
      );
    }
    const x = (values.pages + 1) * 44;
    out.push(
      rectShape(x, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
      iconShape("chevron-right", x + 8, 8, 20, "muted"),
    );
    return out;
  },
);

export const steps = defineParametric(
  "steps",
  "Step indicator",
  "Navigation",
  [
    text("labels", "Steps", "Account, Details, Done"),
    num("current", "Current (1-based)", 2, 1, 8),
    num("gap", "Spacing", 124, 60, 300),
  ],
  (_t, values) => {
    const labels = list(values.labels);
    const out: Shape[] = [];
    labels.forEach((lb, index) => {
      const x = index * values.gap;
      if (index > 0) {
        out.push(
          lineShape(
            [
              [x - values.gap + 32, 16],
              [x, 16],
            ],
            { s: index < values.current ? "accent" : "border", sw: 2 },
          ),
        );
      }
      const done = index + 1 < values.current;
      const on = index + 1 === values.current;
      out.push(
        ellipseShape(x, 0, 32, 32, {
          f: done ? "accent" : "surface",
          s: done || on ? "accent" : "border",
          sw: on ? 2 : 1,
        }),
      );
      if (done) {
        out.push(iconShape("check", x + 8, 8, 16, "onAccent"));
      } else {
        out.push(
          textShape(
            String(index + 1),
            x + 16,
            16,
            13,
            on ? "accent" : "muted",
            "middle",
          ),
        );
      }
      out.push(textShape(lb, x + 16, 46, 11, on ? "text" : "muted", "middle"));
    });
    return out;
  },
  "wizard progress",
);

export const drawer = defineParametric(
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
  (_t, values) => {
    const items = list(values.items).map((x) =>
      x.split(":").map((y) => y.trim()),
    );
    const height = 72 + items.length * 56 + 16;
    const out: Shape[] = [
      rectShape(0, 0, values.width, height, {
        r: "card",
        f: "surface",
        s: "border",
      }),
      textShape(values.title, 28, 40, 14, "muted"),
    ];
    items.forEach(([lb, ic], index) => {
      const y = 72 + index * 56;
      const on = values.active === index + 1;
      if (on) {
        out.push(
          rectShape(12, y, values.width - 24, 56, {
            r: "pill",
            f: "surfaceAlt",
            s: null,
          }),
        );
      }
      out.push(
        iconShape(ic ?? "home", 28, y + 16, 24, on ? "text" : "muted"),
        textShape(lb, 64, y + 28, 14, on ? "text" : "muted"),
      );
    });
    return out;
  },
  "side navigation menu",
);

export const menu = defineParametric(
  "menu",
  "Menu",
  "Overlays",
  [
    text("items", "Items", "Rename, Duplicate, Share, Delete"),
    num("selected", "Highlighted (0 none)", 0, 0, 10),
    bool("icons", "Icons", true),
    num("width", "Width", 200, 120, 400),
  ],
  (_t, values) => {
    const items = list(values.items);
    const icons: Record<string, string> = {
      Rename: "pencil",
      Duplicate: "copy",
      Share: "share",
      Delete: "trash",
    };
    const out: Shape[] = [
      rectShape(0, 0, values.width, items.length * 40 + 16, {
        r: "ctl",
        f: "surface",
        s: "border",
      }),
    ];
    items.forEach((it, index) => {
      const y = 8 + index * 40;
      const danger = /delete|remove/i.test(it);
      if (values.selected === index + 1) {
        out.push(
          rectShape(6, y, values.width - 12, 40, {
            r: "ctl",
            f: "surfaceAlt",
            s: null,
          }),
        );
      }
      if (values.icons) {
        out.push(
          iconShape(
            icons[it] ?? "chevron-right",
            16,
            y + 10,
            20,
            danger ? "danger" : "muted",
          ),
        );
      }
      out.push(
        textShape(
          it,
          values.icons ? 48 : 16,
          y + 20,
          14,
          danger ? "danger" : "text",
        ),
      );
    });
    return out;
  },
  "context popover dropdown",
);
