import {
  arcPts,
  defineComponent,
  ellipseShape,
  iconShape,
  lineShape,
  rectShape,
  textShape,
  type ComponentDef,
  type Shape,
} from "../shapes";

import { chip, listRow, shift } from "./builders";

export const DISPLAY_COMPONENTS: readonly ComponentDef[] = [
  // display
  defineComponent(
    "badge",
    "Badge",
    "Display",
    56,
    24,
    () => [
      rectShape(0, 0, 56, 24, { r: "pill", f: "success", s: null }),
      textShape("local", 28, 12, 12, "onAccent", "middle"),
    ],
    "tag status",
  ),
  defineComponent(
    "badge-count",
    "Count badge",
    "Display",
    22,
    22,
    () => [
      ellipseShape(0, 0, 22, 22, { f: "danger", s: null }),
      textShape("3", 11, 11, 12, "onAccent", "middle"),
    ],
    "notification",
  ),
  defineComponent(
    "chips",
    "Filter chips",
    "Display",
    440,
    34,
    () => [
      ...chip("All", true, 56),
      ...chip("Recipes", false, 88).map((shape) => shift(shape, 66)),
      ...chip("Drinks", false, 108).map((shape) => shift(shape, 164)),
      ...chip("Sweets", false, 100).map((shape) => shift(shape, 282)),
    ],
    "tabs filter pills",
  ),
  defineComponent(
    "avatar",
    "Avatar",
    "Display",
    44,
    44,
    () => [
      ellipseShape(0, 0, 44, 44, { f: "accent", s: null }),
      textShape("AB", 22, 22, 14, "onAccent", "middle"),
    ],
    "user",
  ),
  defineComponent("avatar-photo", "Avatar, photo", "Display", 44, 44, () => [
    ellipseShape(0, 0, 44, 44, { f: "surfaceAlt", s: "border" }),
    iconShape("user", 10, 10, 24, "muted"),
  ]),
  defineComponent("progress", "Progress bar", "Display", 240, 8, () => [
    rectShape(0, 0, 240, 8, { r: "pill", f: "surfaceAlt", s: null }),
    rectShape(0, 0, 150, 8, { r: "pill", f: "accent", s: null }),
  ]),
  defineComponent(
    "progress-labeled",
    "Progress with label",
    "Display",
    260,
    40,
    () => [
      textShape("Uploading", 0, 8, 13, "muted"),
      textShape("62%", 260, 8, 13, "text", "end"),
      rectShape(0, 26, 260, 8, { r: "pill", f: "surfaceAlt", s: null }),
      rectShape(0, 26, 161, 8, { r: "pill", f: "accent", s: null }),
    ],
  ),
  defineComponent(
    "progress-ring",
    "Progress ring",
    "Display",
    72,
    72,
    () => [
      lineShape(arcPts(36, 36, 30, 0, Math.PI * 2, 36), {
        s: "surfaceAlt",
        sw: 6,
      }),
      lineShape(
        arcPts(36, 36, 30, -Math.PI / 2, -Math.PI / 2 + 0.7 * Math.PI * 2, 28),
        { s: "accent", sw: 6 },
      ),
      textShape("70%", 36, 36, 14, "text", "middle"),
    ],
    "circular",
  ),
  defineComponent("tooltip", "Tooltip", "Display", 120, 44, () => [
    rectShape(0, 0, 120, 32, { r: 8, f: "text", s: null }),
    lineShape(
      [
        [54, 32],
        [60, 40],
        [66, 32],
      ],
      { s: "text", sw: 2 },
    ),
    textShape("Add to queue", 60, 16, 12, "page", "middle"),
  ]),
  defineComponent("card", "Card", "Display", 280, 160, () => [
    rectShape(0, 0, 280, 160, { r: "card", f: "surface", s: "border" }),
    rectShape(0, 0, 280, 80, { r: 0, f: "surfaceAlt", s: null }),
    iconShape("image", 128, 28, 24, "muted"),
    textShape("Card title", 16, 102, 16),
    textShape("A short description of the card.", 16, 128, 12, "muted"),
  ]),
  defineComponent("stat", "Stat card", "Display", 160, 88, () => [
    rectShape(0, 0, 160, 88, { r: "card", f: "surface", s: "border" }),
    textShape("Listeners", 16, 22, 12, "muted"),
    textShape("12.4k", 16, 52, 24),
    textShape("▲ 8%", 16, 74, 12, "success"),
  ]),
  defineComponent("divider", "Divider", "Display", 240, 1, () => [
    rectShape(0, 0, 240, 1, { f: "border", s: null }),
  ]),
  defineComponent("skeleton", "Loading skeleton", "Display", 260, 56, () => [
    ellipseShape(0, 4, 44, 44, { f: "surfaceAlt", s: null }),
    rectShape(56, 8, 180, 12, { r: 6, f: "surfaceAlt", s: null }),
    rectShape(56, 30, 120, 10, { r: 5, f: "surfaceAlt", s: null }),
  ]),
  defineComponent(
    "toast",
    "Toast",
    "Display",
    300,
    52,
    () => [
      rectShape(0, 0, 300, 52, { r: "ctl", f: "text", s: null }),
      iconShape("check-circle", 14, 14, 24, "success"),
      textShape("Added to your library", 48, 26, 14, "page"),
    ],
    "snackbar",
  ),
  defineComponent(
    "alert",
    "Alert",
    "Display",
    320,
    64,
    () => [
      rectShape(0, 0, 320, 64, { r: "ctl", f: "surfaceAlt", s: "danger" }),
      iconShape("warning", 14, 20, 24, "danger"),
      textShape("Something went wrong", 52, 24, 14),
      textShape("Check your connection and retry.", 52, 44, 12, "muted"),
    ],
    "error warning",
  ),
  // lists
  defineComponent(
    "list-row",
    "List row",
    "Lists",
    340,
    68,
    () =>
      listRow("success", "Chocolate with milk", "Recipes · Dessert", [
        "play",
        "layers",
        "download",
      ]),
    "track item",
  ),
  defineComponent("list-row-error", "List row, error", "Lists", 340, 68, () =>
    listRow(
      "danger",
      "Hot chocolate, the long version",
      "Recipes · too long for a card",
      ["play"],
    ),
  ),
  defineComponent("list-simple", "List item", "Lists", 300, 56, () => [
    rectShape(0, 0, 300, 56, { r: 0, f: "surface", s: null }),
    iconShape("folder", 14, 16, 24, "accent"),
    textShape("Documents", 52, 28, 14),
    iconShape("chevron-right", 266, 16, 24, "muted"),
    rectShape(0, 55, 300, 1, { f: "border", s: null }),
  ]),
  defineComponent("list-switch", "Setting row", "Lists", 300, 56, () => [
    rectShape(0, 0, 300, 56, { r: 0, f: "surface", s: null }),
    textShape("Notifications", 14, 28, 14),
    rectShape(238, 14, 48, 28, { r: "pill", f: "accent", s: "accent" }),
    ellipseShape(262, 18, 20, 20, { f: "onAccent", s: null }),
    rectShape(0, 55, 300, 1, { f: "border", s: null }),
  ]),
  defineComponent("table", "Table", "Lists", 360, 132, () => {
    const out: Shape[] = [
      rectShape(0, 0, 360, 132, { r: "card", f: "surface", s: "border" }),
      rectShape(0, 0, 360, 36, { r: 0, f: "surfaceAlt", s: null }),
      textShape("Name", 16, 18, 12, "muted"),
      textShape("Source", 160, 18, 12, "muted"),
      textShape("Length", 344, 18, 12, "muted", "end"),
    ];
    ["Pancakes", "Apple pie", "Tomato soup"].forEach((recipe, index) => {
      const y = 54 + index * 32;
      out.push(
        lineShape(
          [
            [0, y + 16],
            [360, y + 16],
          ],
          { s: "border", sw: 1 },
        ),
        textShape(recipe, 16, y, 13),
        textShape("Recipes", 160, y, 13, "muted"),
        textShape(`${3 + index}:${10 + index * 7}`, 344, y, 13, "muted", "end"),
      );
    });
    return out;
  }),
];
