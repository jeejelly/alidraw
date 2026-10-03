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

export const accordion = defineParametric(
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
  (_t, values) => {
    const open = new Set(list(values.open).map(Number));
    const titles = list(values.titles);
    const out: Shape[] = [];
    const width = values.width;
    let y = 0;
    const bar = (title: string, indent: number, isOpen: boolean) => {
      const height = 48;
      out.push(
        rectShape(indent, y, width - indent, height, {
          r: 0,
          f: values.style === "filled" ? "surfaceAlt" : "surface",
          s: values.style === "plain" ? null : "border",
        }),
      );
      if (values.icon !== "none") {
        out.push(
          iconShape(
            isOpen && values.icon === "folder" ? "folder-plus" : values.icon,
            indent + 14,
            y + 12,
            24,
            "text",
          ),
        );
      }
      out.push(
        textShape(
          title,
          indent + (values.icon !== "none" ? 52 : 16),
          y + height / 2,
          14,
        ),
        iconShape(
          isOpen ? "chevron-up" : "chevron-down",
          width - 40,
          y + 12,
          24,
          "text",
        ),
      );
      y += height;
    };
    titles.forEach((title, index) => {
      const isOpen = open.has(index + 1);
      bar(title, 0, isOpen);
      if (isOpen) {
        if (values.children > 0) {
          for (let child = 0; child < values.children; child++) {
            bar(
              `${title} / ${
                ["Outline", "Container", "Label", "Icon", "Shape"][child % 5]
              }`,
              12,
              false,
            );
          }
        } else if (values.content > 0) {
          out.push(
            rectShape(0, y, width, values.content, {
              r: 0,
              f: "page",
              s: "border",
            }),
            textShape("Content", 16, y + values.content / 2, 13, "muted"),
          );
          y += values.content;
        }
      }
    });
    return out;
  },
  "accordion expand disclosure tree sections",
);

export const rows = defineParametric(
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
  (_t, values) => {
    const out: Shape[] = [];
    const height = values.lines === "two" ? 64 : 48;
    const gap = values.style === "cards" ? 8 : 0;
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
    for (let index = 0; index < values.rows; index++) {
      const y = index * (height + gap);
      const sel = values.selected === index + 1;
      out.push(
        rectShape(0, y, values.width, height, {
          r: values.style === "cards" ? "card" : 0,
          f: sel ? "surfaceAlt" : "surface",
          s: values.style === "cards" ? null : null,
        }),
      );
      if (values.style === "lines" && index < values.rows - 1) {
        out.push(
          rectShape(0, y + height - 1, values.width, 1, {
            f: "border",
            s: null,
          }),
        );
      }
      let x = 14;
      if (values.leading === "icon") {
        out.push(iconShape("music", x, y + height / 2 - 12, 24, "accent"));
        x += 40;
      } else if (values.leading === "avatar") {
        out.push(
          ellipseShape(x, y + height / 2 - 18, 36, 36, {
            f: "accent",
            s: null,
          }),
          textShape(
            titles[index % 10][0],
            x + 18,
            y + height / 2,
            13,
            "onAccent",
            "middle",
          ),
        );
        x += 50;
      } else if (values.leading === "status") {
        out.push(
          rectShape(x - 4, y + 12, 4, height - 24, {
            r: 2,
            f: index % 4 === 3 ? "danger" : "success",
            s: null,
          }),
        );
        x += 12;
      }
      out.push(
        textShape(
          titles[index % 10],
          x,
          y + (values.lines === "two" ? height / 2 - 10 : height / 2),
          14,
        ),
      );
      if (values.lines === "two") {
        out.push(
          textShape("Secondary text", x, y + height / 2 + 12, 12, "muted"),
        );
      }
      const end = values.width - 14;
      if (values.trailing === "chevron") {
        out.push(
          iconShape(
            "chevron-right",
            end - 24,
            y + height / 2 - 12,
            24,
            "muted",
          ),
        );
      } else if (values.trailing === "switch") {
        out.push(
          rectShape(end - 48, y + height / 2 - 14, 48, 28, {
            r: "pill",
            f: index % 2 ? "surfaceAlt" : "accent",
            s: null,
          }),
          ellipseShape(
            index % 2 ? end - 44 : end - 24,
            y + height / 2 - 10,
            20,
            20,
            {
              f: index % 2 ? "muted" : "onAccent",
              s: null,
            },
          ),
        );
      } else if (values.trailing === "actions") {
        ["play", "download"].forEach((ic, slot) => {
          const bx = end - 40 * (2 - slot) - 6 * (1 - slot);
          out.push(
            rectShape(bx, y + height / 2 - 20, 40, 40, {
              r: "pill",
              f: "accent",
              s: null,
            }),
            iconShape(ic, bx + 10, y + height / 2 - 10, 20, "onAccent"),
          );
        });
      } else if (values.trailing === "text") {
        out.push(
          textShape(
            `${2 + index}:${10 + index * 7}`,
            end,
            y + height / 2,
            13,
            "muted",
            "end",
          ),
        );
      }
    }
    return out;
  },
  "rows items settings",
);

export const table = defineParametric(
  "table",
  "Table",
  "Lists",
  [
    text("cols", "Columns", "Name, Source, Length"),
    num("rows", "Rows", 3, 1, 12),
    num("width", "Width", 360, 200, 800),
    bool("stripes", "Striped", false),
  ],
  (_t, values) => {
    const cols = list(values.cols);
    const cw = values.width / cols.length;
    const height = 36 + values.rows * 36;
    const out: Shape[] = [
      rectShape(0, 0, values.width, height, {
        r: "card",
        f: "surface",
        s: "border",
      }),
      rectShape(0, 0, values.width, 36, { r: 0, f: "surfaceAlt", s: null }),
    ];
    cols.forEach((column, index) =>
      out.push(textShape(column, 16 + index * cw, 18, 12, "muted")),
    );
    for (let row = 0; row < values.rows; row++) {
      const y = 36 + row * 36;
      if (values.stripes && row % 2) {
        out.push(
          rectShape(1, y, values.width - 2, 36, { r: 0, f: "page", s: null }),
        );
      }
      out.push(
        lineShape(
          [
            [0, y],
            [values.width, y],
          ],
          { s: "border", sw: 1 },
        ),
      );
      cols.forEach((_c, index) =>
        out.push(
          textShape(
            index === 0
              ? [
                  "Pancakes",
                  "Apple pie",
                  "Tomato soup",
                  "Rice bowl",
                  "Fruit salad",
                ][row % 5]
              : index === 1
              ? "Recipes"
              : `${3 + (row % 4)}:${10 + row * 5}`,
            16 + index * cw,
            y + 18,
            13,
            index === 0 ? "text" : "muted",
          ),
        ),
      );
    }
    return out;
  },
  "grid data",
);

export const badge = defineParametric(
  "badge",
  "Badge",
  "Display",
  [
    text("text", "Text", "local"),
    pick("look", "Look", "pill", ["pill", "dot", "count"]),
    pick("tone", "Tone", "success", ["success", "accent", "danger", "muted"]),
  ],
  (_t, values) => {
    const tone = values.tone as Token;
    if (values.look === "dot") {
      return [ellipseShape(0, 0, 10, 10, { f: tone, s: null })];
    }
    if (values.look === "count") {
      return [
        ellipseShape(0, 0, 22, 22, { f: tone, s: null }),
        textShape(values.text.slice(0, 2), 11, 11, 12, "onAccent", "middle"),
      ];
    }
    const width = tw(values.text, 12) + 20;
    return [
      rectShape(0, 0, width, 24, { r: "pill", f: tone, s: null }),
      textShape(values.text, width / 2, 12, 12, "onAccent", "middle"),
    ];
  },
  "tag label status count",
);

export const carousel = defineParametric(
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
  (_t, values) => {
    const height = values.height;
    const out: Shape[] = [];
    let x = 0;
    for (let index = 0; index < values.items; index++) {
      const on = values.active === index + 1;
      const width =
        values.style === "hero"
          ? on
            ? height * 2
            : 40
          : values.style === "uncontained"
          ? height * 1.2
          : on
          ? height * 1.6
          : index === values.active
          ? height * 0.9
          : height * 0.5;
      out.push(
        rectShape(x, 0, width, height, {
          r: "card",
          f: on ? "surfaceAlt" : "surface",
          s: "border",
        }),
      );
      if (width > 60) {
        out.push(
          iconShape("image", x + width / 2 - 14, height / 2 - 14, 28, "muted"),
        );
        if (values.labels) {
          out.push(
            textShape(`Item ${index + 1}`, x + 12, height - 16, 12, "text"),
          );
        }
      }
      x += width + 8;
    }
    return out;
  },
  "slider gallery hero",
);

export const card = defineParametric(
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
  (_t, values) => {
    const media = values.media ? 80 : 0;
    const height = media + 84 + (values.actions ? 52 : 0);
    const out: Shape[] = [
      rectShape(0, 0, values.width, height, {
        r: "card",
        f: values.look === "filled" ? "surfaceAlt" : "surface",
        s: values.look === "elevated" ? null : "border",
      }),
    ];
    if (values.look === "elevated") {
      out.push(
        rectShape(2, 4, values.width, height, {
          r: "card",
          f: null,
          s: "border",
          sw: 1,
        }),
      );
    }
    if (values.media) {
      out.push(
        rectShape(0, 0, values.width, media, {
          r: 0,
          f: "surfaceAlt",
          s: null,
        }),
        iconShape("image", values.width / 2 - 14, 26, 28, "muted"),
      );
    }
    out.push(
      textShape(values.title, 16, media + 24, 16),
      textShape(values.body, 16, media + 52, 12, "muted"),
    );
    if (values.actions) {
      out.push(
        rectShape(values.width - 96, height - 48, 80, 36, {
          r: "ctl",
          f: "accent",
          s: null,
        }),
        textShape(
          "Open",
          values.width - 56,
          height - 30,
          13,
          "onAccent",
          "middle",
        ),
      );
    }
    return out;
  },
  "tile panel",
);

export const tooltip = defineParametric(
  "tooltip",
  "Tooltip",
  "Display",
  [
    pick("kind", "Kind", "plain", ["plain", "rich"]),
    text("text", "Text", "Add to queue"),
    text("title", "Title (rich)", "Queue"),
    text("action", "Action (rich)", "Learn more"),
  ],
  (_t, values) => {
    if (values.kind === "rich") {
      const width = Math.max(200, tw(values.text, 12) + 32);
      return [
        rectShape(0, 0, width, 112, { r: 12, f: "surface", s: "border" }),
        textShape(values.title, 16, 24, 14, "text"),
        textShape(values.text, 16, 52, 12, "muted"),
        textShape(values.action, 16, 90, 13, "accent"),
      ];
    }
    const width = tw(values.text, 12) + 24;
    return [
      rectShape(0, 0, width, 28, { r: 6, f: "text", s: null }),
      textShape(values.text, width / 2, 14, 12, "page", "middle"),
    ];
  },
  "hint help",
);
