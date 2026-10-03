import {
  iconShape,
  defineParametric,
  rectShape,
  textShape,
  type Shape,
} from "../shapes";

import { num, bool, text, pick, tw, list } from "./helpers";

export const dialog = defineParametric(
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
  (_t, values) => {
    const out: Shape[] = [
      rectShape(0, 0, values.width, 176, {
        r: "card",
        f: "surface",
        s: "border",
      }),
    ];
    const x = values.icon !== "none" ? 56 : 20;
    if (values.icon !== "none") {
      out.push(
        iconShape(values.icon, 20, 20, 28, values.danger ? "danger" : "accent"),
      );
    }
    out.push(
      textShape(values.title, x, 34, 17),
      textShape(values.body, 20, 72, 13, "muted"),
    );
    const bw = Math.max(80, tw(values.confirm, 13) + 32);
    const cw = Math.max(80, tw(values.cancel, 13) + 32);
    out.push(
      rectShape(values.width - 20 - bw, 120, bw, 40, {
        r: "ctl",
        f: values.danger ? "danger" : "accent",
        s: null,
      }),
      textShape(
        values.confirm,
        values.width - 20 - bw / 2,
        140,
        13,
        "onAccent",
        "middle",
      ),
      rectShape(values.width - 28 - bw - cw, 120, cw, 40, {
        r: "ctl",
        f: null,
        s: "border",
      }),
      textShape(
        values.cancel,
        values.width - 28 - bw - cw / 2,
        140,
        13,
        "text",
        "middle",
      ),
    );
    return out;
  },
  "modal confirm alert",
);

export const sheet = defineParametric(
  "sheet",
  "Sheet",
  "Overlays",
  [
    pick("side", "Side", "bottom", ["bottom", "side"]),
    text("title", "Title", "Add to…"),
    text("items", "Items", "Queue, Favourites, New playlist"),
    num("width", "Width", 360, 220, 600),
  ],
  (_t, values) => {
    const items = list(values.items);
    const icons = ["layers", "heart", "folder-plus", "share", "download"];
    const side = values.side === "side";
    const height = 76 + items.length * 40;
    const out: Shape[] = [
      rectShape(
        0,
        0,
        side ? Math.min(values.width, 320) : values.width,
        side ? Math.max(height, 360) : height,
        { r: "card", f: "surface", s: "border" },
      ),
    ];
    if (!side) {
      out.push(
        rectShape(values.width / 2 - 30, 10, 60, 5, {
          r: 3,
          f: "border",
          s: null,
        }),
      );
    }
    out.push(textShape(values.title, 20, 44, 16));
    items.forEach((it, index) =>
      out.push(
        iconShape(icons[index % 5], 20, 66 + index * 40, 22, "accent"),
        textShape(it, 56, 77 + index * 40, 14),
      ),
    );
    return out;
  },
  "bottom sheet drawer panel",
);

export const snackbar = defineParametric(
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
  (_t, values) => {
    const out: Shape[] = [
      rectShape(0, 0, values.width, 52, { r: "ctl", f: "text", s: null }),
    ];
    let x = 16;
    if (values.icon !== "none") {
      out.push(
        iconShape(
          values.icon,
          14,
          14,
          24,
          values.icon === "warning" ? "danger" : "success",
        ),
      );
      x = 50;
    }
    out.push(textShape(values.message, x, 26, 14, "page"));
    if (values.action) {
      out.push(
        textShape(values.action, values.width - 16, 26, 14, "accent", "end"),
      );
    }
    return out;
  },
  "toast notification",
);
