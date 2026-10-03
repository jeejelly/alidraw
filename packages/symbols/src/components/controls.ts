import { type Token } from "../theme";
import {
  arcPts,
  defineComponent,
  deg,
  ellipseShape,
  iconShape,
  lineShape,
  rectShape,
  textShape,
  type ComponentDef,
} from "../shapes";

import { button, checkbox, radio, toggle, month, field } from "./builders";

export const CONTROL_COMPONENTS: readonly ComponentDef[] = [
  // buttons
  button("button-primary", "Primary button", "Continue", "primary"),
  button("button-secondary", "Secondary button", "Cancel", "secondary"),
  button("button-ghost", "Outline button", "Learn more", "ghost"),
  button("button-danger", "Danger button", "Delete", "danger"),
  defineComponent(
    "button-icon",
    "Round icon button",
    "Buttons",
    40,
    40,
    () => [
      rectShape(0, 0, 40, 40, { r: "pill", f: "accent", s: null }),
      iconShape("play", 10, 10, 20, "onAccent"),
    ],
    "play pill",
  ),
  defineComponent(
    "button-icon-soft",
    "Soft icon button",
    "Buttons",
    40,
    40,
    () => [
      rectShape(0, 0, 40, 40, { r: "pill", f: "surfaceAlt", s: null }),
      iconShape("layers", 10, 10, 20, "accent"),
    ],
  ),
  defineComponent(
    "button-fab",
    "Floating action",
    "Buttons",
    56,
    56,
    () => [
      ellipseShape(0, 0, 56, 56, { f: "accent", s: null }),
      iconShape("plus", 16, 16, 24, "onAccent"),
    ],
    "fab",
  ),
  defineComponent(
    "button-group",
    "Icon button group",
    "Buttons",
    140,
    40,
    () => [
      rectShape(0, 0, 40, 40, { r: "pill", f: "accent", s: null }),
      iconShape("play", 10, 10, 20, "onAccent"),
      rectShape(50, 0, 40, 40, { r: "pill", f: "accent", s: null }),
      iconShape("layers", 60, 10, 20, "onAccent"),
      rectShape(100, 0, 40, 40, { r: "pill", f: "accent", s: null }),
      iconShape("download", 110, 10, 20, "onAccent"),
    ],
    "actions",
  ),
  // inputs
  field("input-text", "Text field", null, "Label", false),
  field(
    "input-search",
    "Search field",
    "search",
    "Search or paste a link",
    true,
    280,
    "close",
  ),
  field(
    "input-password",
    "Password field",
    "lock",
    "••••••••",
    false,
    280,
    "eye",
  ),
  defineComponent("input-textarea", "Text area", "Inputs", 280, 96, () => [
    rectShape(0, 0, 280, 96, { r: "ctl", f: "surface", s: "border" }),
    textShape("Write a message…", 14, 22, 14, "muted"),
  ]),
  defineComponent(
    "input-select",
    "Select",
    "Inputs",
    220,
    44,
    () => [
      rectShape(0, 0, 220, 44, { r: "ctl", f: "surface", s: "border" }),
      textShape("Choose one", 14, 22, 14, "muted"),
      iconShape("chevron-down", 188, 12, 20, "muted"),
    ],
    "dropdown",
  ),
  defineComponent("input-labeled", "Labelled field", "Inputs", 280, 72, () => [
    textShape("Email", 0, 8, 12, "muted"),
    rectShape(0, 22, 280, 44, { r: "ctl", f: "surface", s: "border" }),
    textShape("name@example.com", 14, 44, 14),
  ]),
  defineComponent("input-error", "Field with error", "Inputs", 280, 72, () => [
    rectShape(0, 0, 280, 44, { r: "ctl", f: "surface", s: "danger" }),
    textShape("name@", 14, 22, 14),
    textShape("Enter a valid address", 0, 58, 12, "danger"),
  ]),
  checkbox(true),
  checkbox(false),
  radio(true),
  radio(false),
  toggle(true),
  toggle(false),
  defineComponent(
    "slider",
    "Slider",
    "Inputs",
    240,
    24,
    () => [
      rectShape(0, 10, 240, 4, { r: "pill", f: "surfaceAlt", s: null }),
      rectShape(0, 10, 150, 4, { r: "pill", f: "accent", s: null }),
      ellipseShape(138, 2, 20, 20, { f: "onAccent", s: "accent", sw: 2 }),
    ],
    "range volume",
  ),
  defineComponent(
    "slider-range",
    "Range slider",
    "Inputs",
    240,
    24,
    () => [
      rectShape(0, 10, 240, 4, { r: "pill", f: "surfaceAlt", s: null }),
      rectShape(60, 10, 120, 4, { r: "pill", f: "accent", s: null }),
      ellipseShape(50, 2, 20, 20, { f: "onAccent", s: "accent", sw: 2 }),
      ellipseShape(170, 2, 20, 20, { f: "onAccent", s: "accent", sw: 2 }),
    ],
    "range min max",
  ),
  defineComponent(
    "slider-labeled",
    "Slider with value",
    "Inputs",
    260,
    52,
    () => [
      textShape("Volume", 0, 8, 13, "muted"),
      textShape("65", 260, 8, 13, "text", "end"),
      rectShape(0, 30, 260, 4, { r: "pill", f: "surfaceAlt", s: null }),
      rectShape(0, 30, 169, 4, { r: "pill", f: "accent", s: null }),
      ellipseShape(159, 22, 20, 20, { f: "onAccent", s: "accent", sw: 2 }),
    ],
  ),
  defineComponent(
    "knob",
    "Knob",
    "Inputs",
    88,
    104,
    () => {
      const cx = 44;
      const cy = 44;
      const angle = deg(135 + 0.65 * 270);
      return [
        lineShape(arcPts(cx, cy, 40, deg(135), deg(405)), {
          s: "surfaceAlt",
          sw: 4,
        }),
        lineShape(
          arcPts(
            cx,
            cy,
            40,
            deg(135),
            (135 * Math.PI) / 180 + 0.65 * 1.5 * Math.PI,
          ),
          { s: "accent", sw: 4 },
        ),
        ellipseShape(10, 10, 68, 68, { f: "surfaceAlt", s: "border" }),
        lineShape(
          [
            [cx + Math.cos(angle) * 12, cy + Math.sin(angle) * 12],
            [cx + Math.cos(angle) * 28, cy + Math.sin(angle) * 28],
          ],
          { s: "accent", sw: 3 },
        ),
        textShape("Level", 44, 98, 12, "muted", "middle"),
      ];
    },
    "dial rotary",
  ),
  defineComponent(
    "knob-small",
    "Knob, plain",
    "Inputs",
    64,
    64,
    () => {
      const angle = deg(135 + 0.4 * 270);
      return [
        ellipseShape(0, 0, 64, 64, { f: "surface", s: "border" }),
        ellipseShape(10, 10, 44, 44, { f: "surfaceAlt", s: "border" }),
        lineShape(
          [
            [32 + Math.cos(angle) * 6, 32 + Math.sin(angle) * 6],
            [32 + Math.cos(angle) * 18, 32 + Math.sin(angle) * 18],
          ],
          { s: "accent", sw: 3 },
        ),
      ];
    },
    "dial",
  ),
  defineComponent(
    "stepper",
    "Number stepper",
    "Inputs",
    132,
    40,
    () => [
      rectShape(0, 0, 132, 40, { r: "ctl", f: "surface", s: "border" }),
      iconShape("minus", 8, 10, 20, "muted"),
      textShape("3", 66, 20, 15, "text", "middle"),
      iconShape("plus", 104, 10, 20, "muted"),
    ],
    "quantity",
  ),
  defineComponent(
    "rating",
    "Rating",
    "Inputs",
    124,
    24,
    () =>
      [0, 1, 2, 3, 4].map((index) =>
        iconShape("star", index * 25, 0, 24, index < 4 ? "accent" : "border"),
      ),
    "stars",
  ),
  defineComponent(
    "otp",
    "Code input",
    "Inputs",
    248,
    48,
    () =>
      [0, 1, 2, 3, 4, 5]
        .map((index) =>
          rectShape(index * 42, 0, 38, 48, {
            r: "ctl",
            f: "surface",
            s: index === 2 ? "accent" : "border",
          }),
        )
        .concat([
          textShape("4", 19, 24, 18, "text", "middle"),
          textShape("2", 61, 24, 18, "text", "middle"),
        ]),
    "pin verification",
  ),
  // pickers
  field("date-field", "Date field", "calendar", "17 Sep 2026", false, 220),
  field("time-field", "Time field", "clock", "10:34", false, 160),
  defineComponent(
    "datetime-field",
    "Date and time",
    "Pickers",
    300,
    44,
    () => [
      rectShape(0, 0, 300, 44, { r: "ctl", f: "surface", s: "border" }),
      iconShape("calendar", 12, 12, 20, "muted"),
      textShape("17 Sep 2026", 42, 22, 14),
      rectShape(160, 8, 1, 28, { f: "border", s: null }),
      iconShape("clock", 172, 12, 20, "muted"),
      textShape("10:34", 202, 22, 14),
    ],
    "datetime",
  ),
  defineComponent(
    "calendar",
    "Calendar",
    "Pickers",
    280,
    296,
    (th) => month(th),
    "date picker month",
  ),
  defineComponent(
    "time-picker",
    "Time picker",
    "Pickers",
    200,
    160,
    () => [
      rectShape(0, 0, 200, 160, { r: "card", f: "surface", s: "border" }),
      rectShape(14, 62, 172, 36, { r: "ctl", f: "surfaceAlt", s: null }),
      textShape("09", 60, 20, 14, "muted", "middle"),
      textShape("10", 60, 80, 20, "text", "middle"),
      textShape("11", 60, 140, 14, "muted", "middle"),
      textShape(":", 100, 80, 20, "muted", "middle"),
      textShape("33", 140, 20, 14, "muted", "middle"),
      textShape("34", 140, 80, 20, "accent", "middle"),
      textShape("35", 140, 140, 14, "muted", "middle"),
    ],
    "clock",
  ),
  defineComponent("date-range", "Date range", "Pickers", 300, 44, () => [
    rectShape(0, 0, 300, 44, { r: "ctl", f: "surface", s: "border" }),
    textShape("10 Sep", 14, 22, 14),
    iconShape("arrow-right", 140, 12, 20, "muted"),
    textShape("17 Sep", 176, 22, 14),
  ]),
  defineComponent("color-swatches", "Colour swatches", "Pickers", 232, 32, () =>
    (["accent", "success", "danger", "muted", "text", "border"] as Token[]).map(
      (tk, index) =>
        ellipseShape(index * 40, 0, 32, 32, {
          f: tk,
          s: index === 0 ? "text" : null,
          sw: 2,
        }),
    ),
  ),
];
