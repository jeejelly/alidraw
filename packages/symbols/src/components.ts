import { radiusOf, type SymbolTheme, type Token } from "./theme";
import {
  arcPts,
  c,
  deg,
  E,
  I,
  L,
  R,
  T,
  type ComponentCategory,
  type ComponentDef,
  type Shape,
} from "./shapes";
import { PARAMETRIC, REPLACED } from "./parametric";

export * from "./shapes";

const button = (
  id: string,
  name: string,
  label: string,
  look: "primary" | "secondary" | "ghost" | "danger",
) =>
  c(id, name, "Buttons", 140, 40, () => {
    const fill: Token | null =
      look === "primary"
        ? "accent"
        : look === "danger"
        ? "danger"
        : look === "secondary"
        ? "surfaceAlt"
        : null;
    const edge: Token | null =
      look === "ghost" ? "accent" : look === "secondary" ? "border" : null;
    const ink: Token =
      look === "primary" || look === "danger"
        ? "onAccent"
        : look === "ghost"
        ? "accent"
        : "text";
    return [
      R(0, 0, 140, 40, { r: "ctl", f: fill, s: edge }),
      T(label, 70, 20, 14, ink, "middle"),
    ];
  });

const checkbox = (on: boolean) =>
  c(
    on ? "checkbox-on" : "checkbox-off",
    on ? "Checkbox on" : "Checkbox off",
    "Inputs",
    140,
    24,
    () => [
      R(0, 2, 20, 20, {
        r: 5,
        f: on ? "accent" : "surface",
        s: on ? "accent" : "border",
      }),
      ...(on
        ? [
            L(
              [
                [5, 12],
                [9, 16],
                [16, 8],
              ],
              { s: "onAccent", sw: 2 },
            ),
          ]
        : []),
      T("Remember me", 30, 12, 14),
    ],
  );

const radio = (on: boolean) =>
  c(
    on ? "radio-on" : "radio-off",
    on ? "Radio on" : "Radio off",
    "Inputs",
    140,
    24,
    () => [
      E(0, 2, 20, 20, { f: "surface", s: on ? "accent" : "border" }),
      ...(on ? [E(5, 7, 10, 10, { f: "accent", s: null })] : []),
      T("Option", 30, 12, 14),
    ],
  );

const toggle = (on: boolean) =>
  c(
    on ? "toggle-on" : "toggle-off",
    on ? "Toggle on" : "Toggle off",
    "Inputs",
    48,
    28,
    () => [
      R(0, 0, 48, 28, {
        r: "pill",
        f: on ? "accent" : "surfaceAlt",
        s: on ? "accent" : "border",
      }),
      E(on ? 24 : 4, 4, 20, 20, { f: on ? "onAccent" : "muted", s: null }),
    ],
  );

const chip = (label: string, on: boolean, w: number) => [
  R(0, 0, w, 34, { r: "pill", f: on ? "accent" : "surfaceAlt", s: null }),
  T(label, w / 2, 17, 13, on ? "onAccent" : "accent", "middle"),
];

const listRow = (
  status: Token,
  title: string,
  sub: string,
  actions: string[],
  w = 340,
) => {
  const out: Shape[] = [
    R(0, 0, w, 68, { r: "card", f: "surface", s: null }),
    R(10, 14, 4, 40, { r: 2, f: status, s: null }),
    T(title, 26, 24, 14),
    T(sub, 26, 46, 12, "muted"),
  ];
  actions.forEach((a, k) => {
    const x = w - 12 - 40 * (actions.length - k) - 6 * (actions.length - k - 1);
    out.push(
      R(x, 14, 40, 40, { r: "pill", f: "accent", s: null }),
      I(a, x + 10, 24, 20, "onAccent"),
    );
  });
  return out;
};

const month = (theme: SymbolTheme): Shape[] => {
  const out: Shape[] = [
    R(0, 0, 280, 296, { r: "card", f: "surface", s: "border" }),
    I("chevron-left", 14, 14, 20, "muted"),
    T("September 2026", 140, 24, 15, "text", "middle"),
    I("chevron-right", 246, 14, 20, "muted"),
  ];
  ["M", "T", "W", "T", "F", "S", "S"].forEach((d, k) =>
    out.push(T(d, 20 + k * 40, 56, 12, "muted", "middle")),
  );
  for (let n = 0; n < 35; n++) {
    const day = n - 1; // 1 September 2026 is a Tuesday
    const x = 20 + (n % 7) * 40;
    const y = 90 + Math.floor(n / 7) * 38;
    if (day < 1 || day > 30) {
      continue;
    }
    if (day === 17) {
      out.push(E(x - 17, y - 17, 34, 34, { f: "accent", s: null }));
    }
    out.push(
      T(String(day), x, y, 13, day === 17 ? "onAccent" : "text", "middle"),
    );
  }
  void theme;
  return out;
};

const field = (
  id: string,
  name: string,
  icon: string | null,
  value: string,
  ph: boolean,
  w = 280,
  right?: string,
) =>
  c(id, name, "Inputs", w, 44, () => [
    R(0, 0, w, 44, { r: "ctl", f: "surface", s: "border" }),
    ...(icon ? [I(icon, 12, 12, 20, "muted")] : []),
    T(value, icon ? 42 : 14, 22, 14, ph ? "muted" : "text"),
    ...(right ? [I(right, w - 32, 12, 20, "muted")] : []),
  ]);

const BASIC: readonly ComponentDef[] = [
  // buttons
  button("button-primary", "Primary button", "Continue", "primary"),
  button("button-secondary", "Secondary button", "Cancel", "secondary"),
  button("button-ghost", "Outline button", "Learn more", "ghost"),
  button("button-danger", "Danger button", "Delete", "danger"),
  c(
    "button-icon",
    "Round icon button",
    "Buttons",
    40,
    40,
    () => [
      R(0, 0, 40, 40, { r: "pill", f: "accent", s: null }),
      I("play", 10, 10, 20, "onAccent"),
    ],
    "play pill",
  ),
  c("button-icon-soft", "Soft icon button", "Buttons", 40, 40, () => [
    R(0, 0, 40, 40, { r: "pill", f: "surfaceAlt", s: null }),
    I("layers", 10, 10, 20, "accent"),
  ]),
  c(
    "button-fab",
    "Floating action",
    "Buttons",
    56,
    56,
    () => [
      E(0, 0, 56, 56, { f: "accent", s: null }),
      I("plus", 16, 16, 24, "onAccent"),
    ],
    "fab",
  ),
  c(
    "button-group",
    "Icon button group",
    "Buttons",
    140,
    40,
    () => [
      R(0, 0, 40, 40, { r: "pill", f: "accent", s: null }),
      I("play", 10, 10, 20, "onAccent"),
      R(50, 0, 40, 40, { r: "pill", f: "accent", s: null }),
      I("layers", 60, 10, 20, "onAccent"),
      R(100, 0, 40, 40, { r: "pill", f: "accent", s: null }),
      I("download", 110, 10, 20, "onAccent"),
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
  c("input-textarea", "Text area", "Inputs", 280, 96, () => [
    R(0, 0, 280, 96, { r: "ctl", f: "surface", s: "border" }),
    T("Write a message…", 14, 22, 14, "muted"),
  ]),
  c(
    "input-select",
    "Select",
    "Inputs",
    220,
    44,
    () => [
      R(0, 0, 220, 44, { r: "ctl", f: "surface", s: "border" }),
      T("Choose one", 14, 22, 14, "muted"),
      I("chevron-down", 188, 12, 20, "muted"),
    ],
    "dropdown",
  ),
  c("input-labeled", "Labelled field", "Inputs", 280, 72, () => [
    T("Email", 0, 8, 12, "muted"),
    R(0, 22, 280, 44, { r: "ctl", f: "surface", s: "border" }),
    T("name@example.com", 14, 44, 14),
  ]),
  c("input-error", "Field with error", "Inputs", 280, 72, () => [
    R(0, 0, 280, 44, { r: "ctl", f: "surface", s: "danger" }),
    T("name@", 14, 22, 14),
    T("Enter a valid address", 0, 58, 12, "danger"),
  ]),
  checkbox(true),
  checkbox(false),
  radio(true),
  radio(false),
  toggle(true),
  toggle(false),
  c(
    "slider",
    "Slider",
    "Inputs",
    240,
    24,
    () => [
      R(0, 10, 240, 4, { r: "pill", f: "surfaceAlt", s: null }),
      R(0, 10, 150, 4, { r: "pill", f: "accent", s: null }),
      E(138, 2, 20, 20, { f: "onAccent", s: "accent", sw: 2 }),
    ],
    "range volume",
  ),
  c(
    "slider-range",
    "Range slider",
    "Inputs",
    240,
    24,
    () => [
      R(0, 10, 240, 4, { r: "pill", f: "surfaceAlt", s: null }),
      R(60, 10, 120, 4, { r: "pill", f: "accent", s: null }),
      E(50, 2, 20, 20, { f: "onAccent", s: "accent", sw: 2 }),
      E(170, 2, 20, 20, { f: "onAccent", s: "accent", sw: 2 }),
    ],
    "range min max",
  ),
  c("slider-labeled", "Slider with value", "Inputs", 260, 52, () => [
    T("Volume", 0, 8, 13, "muted"),
    T("65", 260, 8, 13, "text", "end"),
    R(0, 30, 260, 4, { r: "pill", f: "surfaceAlt", s: null }),
    R(0, 30, 169, 4, { r: "pill", f: "accent", s: null }),
    E(159, 22, 20, 20, { f: "onAccent", s: "accent", sw: 2 }),
  ]),
  c(
    "knob",
    "Knob",
    "Inputs",
    88,
    104,
    () => {
      const cx = 44;
      const cy = 44;
      const a = deg(135 + 0.65 * 270);
      return [
        L(arcPts(cx, cy, 40, deg(135), deg(405)), { s: "surfaceAlt", sw: 4 }),
        L(
          arcPts(
            cx,
            cy,
            40,
            deg(135),
            (135 * Math.PI) / 180 + 0.65 * 1.5 * Math.PI,
          ),
          { s: "accent", sw: 4 },
        ),
        E(10, 10, 68, 68, { f: "surfaceAlt", s: "border" }),
        L(
          [
            [cx + Math.cos(a) * 12, cy + Math.sin(a) * 12],
            [cx + Math.cos(a) * 28, cy + Math.sin(a) * 28],
          ],
          { s: "accent", sw: 3 },
        ),
        T("Level", 44, 98, 12, "muted", "middle"),
      ];
    },
    "dial rotary",
  ),
  c(
    "knob-small",
    "Knob, plain",
    "Inputs",
    64,
    64,
    () => {
      const a = deg(135 + 0.4 * 270);
      return [
        E(0, 0, 64, 64, { f: "surface", s: "border" }),
        E(10, 10, 44, 44, { f: "surfaceAlt", s: "border" }),
        L(
          [
            [32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6],
            [32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18],
          ],
          { s: "accent", sw: 3 },
        ),
      ];
    },
    "dial",
  ),
  c(
    "stepper",
    "Number stepper",
    "Inputs",
    132,
    40,
    () => [
      R(0, 0, 132, 40, { r: "ctl", f: "surface", s: "border" }),
      I("minus", 8, 10, 20, "muted"),
      T("3", 66, 20, 15, "text", "middle"),
      I("plus", 104, 10, 20, "muted"),
    ],
    "quantity",
  ),
  c(
    "rating",
    "Rating",
    "Inputs",
    124,
    24,
    () =>
      [0, 1, 2, 3, 4].map((k) =>
        I("star", k * 25, 0, 24, k < 4 ? "accent" : "border"),
      ),
    "stars",
  ),
  c(
    "otp",
    "Code input",
    "Inputs",
    248,
    48,
    () =>
      [0, 1, 2, 3, 4, 5]
        .map((k) =>
          R(k * 42, 0, 38, 48, {
            r: "ctl",
            f: "surface",
            s: k === 2 ? "accent" : "border",
          }),
        )
        .concat([
          T("4", 19, 24, 18, "text", "middle"),
          T("2", 61, 24, 18, "text", "middle"),
        ]),
    "pin verification",
  ),
  // pickers
  field("date-field", "Date field", "calendar", "17 Sep 2026", false, 220),
  field("time-field", "Time field", "clock", "10:34", false, 160),
  c(
    "datetime-field",
    "Date and time",
    "Pickers",
    300,
    44,
    () => [
      R(0, 0, 300, 44, { r: "ctl", f: "surface", s: "border" }),
      I("calendar", 12, 12, 20, "muted"),
      T("17 Sep 2026", 42, 22, 14),
      R(160, 8, 1, 28, { f: "border", s: null }),
      I("clock", 172, 12, 20, "muted"),
      T("10:34", 202, 22, 14),
    ],
    "datetime",
  ),
  c(
    "calendar",
    "Calendar",
    "Pickers",
    280,
    296,
    (th) => month(th),
    "date picker month",
  ),
  c(
    "time-picker",
    "Time picker",
    "Pickers",
    200,
    160,
    () => [
      R(0, 0, 200, 160, { r: "card", f: "surface", s: "border" }),
      R(14, 62, 172, 36, { r: "ctl", f: "surfaceAlt", s: null }),
      T("09", 60, 20, 14, "muted", "middle"),
      T("10", 60, 80, 20, "text", "middle"),
      T("11", 60, 140, 14, "muted", "middle"),
      T(":", 100, 80, 20, "muted", "middle"),
      T("33", 140, 20, 14, "muted", "middle"),
      T("34", 140, 80, 20, "accent", "middle"),
      T("35", 140, 140, 14, "muted", "middle"),
    ],
    "clock",
  ),
  c("date-range", "Date range", "Pickers", 300, 44, () => [
    R(0, 0, 300, 44, { r: "ctl", f: "surface", s: "border" }),
    T("10 Sep", 14, 22, 14),
    I("arrow-right", 140, 12, 20, "muted"),
    T("17 Sep", 176, 22, 14),
  ]),
  c("color-swatches", "Colour swatches", "Pickers", 232, 32, () =>
    (["accent", "success", "danger", "muted", "text", "border"] as Token[]).map(
      (tk, k) =>
        E(k * 40, 0, 32, 32, { f: tk, s: k === 0 ? "text" : null, sw: 2 }),
    ),
  ),
  // display
  c(
    "badge",
    "Badge",
    "Display",
    56,
    24,
    () => [
      R(0, 0, 56, 24, { r: "pill", f: "success", s: null }),
      T("local", 28, 12, 12, "onAccent", "middle"),
    ],
    "tag status",
  ),
  c(
    "badge-count",
    "Count badge",
    "Display",
    22,
    22,
    () => [
      E(0, 0, 22, 22, { f: "danger", s: null }),
      T("3", 11, 11, 12, "onAccent", "middle"),
    ],
    "notification",
  ),
  c(
    "chips",
    "Filter chips",
    "Display",
    440,
    34,
    () => [
      ...chip("All", true, 56),
      ...chip("Recipes", false, 88).map((s) => shift(s, 66)),
      ...chip("Drinks", false, 108).map((s) => shift(s, 164)),
      ...chip("Sweets", false, 100).map((s) => shift(s, 282)),
    ],
    "tabs filter pills",
  ),
  c(
    "avatar",
    "Avatar",
    "Display",
    44,
    44,
    () => [
      E(0, 0, 44, 44, { f: "accent", s: null }),
      T("AB", 22, 22, 14, "onAccent", "middle"),
    ],
    "user",
  ),
  c("avatar-photo", "Avatar, photo", "Display", 44, 44, () => [
    E(0, 0, 44, 44, { f: "surfaceAlt", s: "border" }),
    I("user", 10, 10, 24, "muted"),
  ]),
  c("progress", "Progress bar", "Display", 240, 8, () => [
    R(0, 0, 240, 8, { r: "pill", f: "surfaceAlt", s: null }),
    R(0, 0, 150, 8, { r: "pill", f: "accent", s: null }),
  ]),
  c("progress-labeled", "Progress with label", "Display", 260, 40, () => [
    T("Uploading", 0, 8, 13, "muted"),
    T("62%", 260, 8, 13, "text", "end"),
    R(0, 26, 260, 8, { r: "pill", f: "surfaceAlt", s: null }),
    R(0, 26, 161, 8, { r: "pill", f: "accent", s: null }),
  ]),
  c(
    "progress-ring",
    "Progress ring",
    "Display",
    72,
    72,
    () => [
      L(arcPts(36, 36, 30, 0, Math.PI * 2, 36), { s: "surfaceAlt", sw: 6 }),
      L(
        arcPts(36, 36, 30, -Math.PI / 2, -Math.PI / 2 + 0.7 * Math.PI * 2, 28),
        { s: "accent", sw: 6 },
      ),
      T("70%", 36, 36, 14, "text", "middle"),
    ],
    "circular",
  ),
  c("tooltip", "Tooltip", "Display", 120, 44, () => [
    R(0, 0, 120, 32, { r: 8, f: "text", s: null }),
    L(
      [
        [54, 32],
        [60, 40],
        [66, 32],
      ],
      { s: "text", sw: 2 },
    ),
    T("Add to queue", 60, 16, 12, "page", "middle"),
  ]),
  c("card", "Card", "Display", 280, 160, () => [
    R(0, 0, 280, 160, { r: "card", f: "surface", s: "border" }),
    R(0, 0, 280, 80, { r: 0, f: "surfaceAlt", s: null }),
    I("image", 128, 28, 24, "muted"),
    T("Card title", 16, 102, 16),
    T("A short description of the card.", 16, 128, 12, "muted"),
  ]),
  c("stat", "Stat card", "Display", 160, 88, () => [
    R(0, 0, 160, 88, { r: "card", f: "surface", s: "border" }),
    T("Listeners", 16, 22, 12, "muted"),
    T("12.4k", 16, 52, 24),
    T("▲ 8%", 16, 74, 12, "success"),
  ]),
  c("divider", "Divider", "Display", 240, 1, () => [
    R(0, 0, 240, 1, { f: "border", s: null }),
  ]),
  c("skeleton", "Loading skeleton", "Display", 260, 56, () => [
    E(0, 4, 44, 44, { f: "surfaceAlt", s: null }),
    R(56, 8, 180, 12, { r: 6, f: "surfaceAlt", s: null }),
    R(56, 30, 120, 10, { r: 5, f: "surfaceAlt", s: null }),
  ]),
  c(
    "toast",
    "Toast",
    "Display",
    300,
    52,
    () => [
      R(0, 0, 300, 52, { r: "ctl", f: "text", s: null }),
      I("check-circle", 14, 14, 24, "success"),
      T("Added to your library", 48, 26, 14, "page"),
    ],
    "snackbar",
  ),
  c(
    "alert",
    "Alert",
    "Display",
    320,
    64,
    () => [
      R(0, 0, 320, 64, { r: "ctl", f: "surfaceAlt", s: "danger" }),
      I("warning", 14, 20, 24, "danger"),
      T("Something went wrong", 52, 24, 14),
      T("Check your connection and retry.", 52, 44, 12, "muted"),
    ],
    "error warning",
  ),
  // lists
  c(
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
  c("list-row-error", "List row, error", "Lists", 340, 68, () =>
    listRow(
      "danger",
      "Hot chocolate, the long version",
      "Recipes · too long for a card",
      ["play"],
    ),
  ),
  c("list-simple", "List item", "Lists", 300, 56, () => [
    R(0, 0, 300, 56, { r: 0, f: "surface", s: null }),
    I("folder", 14, 16, 24, "accent"),
    T("Documents", 52, 28, 14),
    I("chevron-right", 266, 16, 24, "muted"),
    R(0, 55, 300, 1, { f: "border", s: null }),
  ]),
  c("list-switch", "Setting row", "Lists", 300, 56, () => [
    R(0, 0, 300, 56, { r: 0, f: "surface", s: null }),
    T("Notifications", 14, 28, 14),
    R(238, 14, 48, 28, { r: "pill", f: "accent", s: "accent" }),
    E(262, 18, 20, 20, { f: "onAccent", s: null }),
    R(0, 55, 300, 1, { f: "border", s: null }),
  ]),
  c("table", "Table", "Lists", 360, 132, () => {
    const out: Shape[] = [
      R(0, 0, 360, 132, { r: "card", f: "surface", s: "border" }),
      R(0, 0, 360, 36, { r: 0, f: "surfaceAlt", s: null }),
      T("Name", 16, 18, 12, "muted"),
      T("Source", 160, 18, 12, "muted"),
      T("Length", 344, 18, 12, "muted", "end"),
    ];
    ["Pancakes", "Apple pie", "Tomato soup"].forEach((n, k) => {
      const y = 54 + k * 32;
      out.push(
        L(
          [
            [0, y + 16],
            [360, y + 16],
          ],
          { s: "border", sw: 1 },
        ),
        T(n, 16, y, 13),
        T("Recipes", 160, y, 13, "muted"),
        T(`${3 + k}:${10 + k * 7}`, 344, y, 13, "muted", "end"),
      );
    });
    return out;
  }),
  // navigation
  c("tabs", "Tabs", "Navigation", 300, 44, () => [
    T("All", 50, 20, 14, "accent", "middle"),
    T("Saved", 150, 20, 14, "muted", "middle"),
    T("Recent", 250, 20, 14, "muted", "middle"),
    R(0, 42, 300, 1, { f: "border", s: null }),
    R(10, 40, 80, 3, { r: 1, f: "accent", s: null }),
  ]),
  c("segmented", "Segmented control", "Navigation", 240, 40, () => [
    R(0, 0, 240, 40, { r: "ctl", f: "surfaceAlt", s: null }),
    R(4, 4, 76, 32, { r: "ctl", f: "surface", s: "border" }),
    T("Day", 42, 20, 13, "text", "middle"),
    T("Week", 120, 20, 13, "muted", "middle"),
    T("Month", 198, 20, 13, "muted", "middle"),
  ]),
  c(
    "navbar",
    "Top bar",
    "Navigation",
    360,
    56,
    () => [
      R(0, 0, 360, 56, { r: 0, f: "surface", s: null }),
      T("My app", 16, 28, 18),
      R(250, 8, 40, 40, { r: "pill", f: "accent", s: null }),
      I("download", 260, 18, 20, "onAccent"),
      R(300, 8, 40, 40, { r: "pill", f: "accent", s: null }),
      I("folder-plus", 310, 18, 20, "onAccent"),
    ],
    "header app bar",
  ),
  c(
    "bottom-nav",
    "Bottom navigation",
    "Navigation",
    360,
    64,
    () => {
      const out: Shape[] = [
        R(0, 0, 360, 64, { r: 0, f: "surface", s: null }),
        R(0, 0, 360, 1, { f: "border", s: null }),
      ];
      [
        ["home", "Home"],
        ["search", "Search"],
        ["heart", "Saved"],
        ["user", "Profile"],
      ].forEach(([ic, lb], k) => {
        const x = 45 + k * 90;
        out.push(
          I(ic, x - 11, 10, 22, k === 0 ? "accent" : "muted"),
          T(lb, x, 46, 11, k === 0 ? "accent" : "muted", "middle"),
        );
      });
      return out;
    },
    "tab bar",
  ),
  c("sidebar", "Sidebar", "Navigation", 220, 260, () => {
    const out: Shape[] = [
      R(0, 0, 220, 260, { r: 0, f: "surface", s: "border" }),
      T("Workspace", 16, 28, 15),
    ];
    [
      ["home", "Overview"],
      ["layers", "Projects"],
      ["users", "Team"],
      ["settings", "Settings"],
    ].forEach(([ic, lb], k) => {
      const y = 56 + k * 48;
      if (k === 0) {
        out.push(R(8, y, 204, 40, { r: "ctl", f: "surfaceAlt", s: null }));
      }
      out.push(
        I(ic, 20, y + 8, 24, k === 0 ? "accent" : "muted"),
        T(lb, 56, y + 20, 14, k === 0 ? "text" : "muted"),
      );
    });
    return out;
  }),
  c("breadcrumb", "Breadcrumb", "Navigation", 260, 24, () => [
    T("Home", 0, 12, 13, "muted"),
    I("chevron-right", 40, 4, 16, "muted"),
    T("Library", 60, 12, 13, "muted"),
    I("chevron-right", 112, 4, 16, "muted"),
    T("Collections", 132, 12, 13),
  ]),
  c("pagination", "Pagination", "Navigation", 260, 36, () => [
    R(0, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
    I("chevron-left", 8, 8, 20, "muted"),
    R(44, 0, 36, 36, { r: "ctl", f: "accent", s: null }),
    T("1", 62, 18, 13, "onAccent", "middle"),
    R(88, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
    T("2", 106, 18, 13, "text", "middle"),
    R(132, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
    T("3", 150, 18, 13, "text", "middle"),
    R(176, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
    I("chevron-right", 184, 8, 20, "muted"),
  ]),
  c(
    "steps",
    "Step indicator",
    "Navigation",
    280,
    56,
    () => [
      L(
        [
          [16, 16],
          [140, 16],
        ],
        { s: "accent", sw: 2 },
      ),
      L(
        [
          [140, 16],
          [264, 16],
        ],
        { s: "border", sw: 2 },
      ),
      E(0, 0, 32, 32, { f: "accent", s: null }),
      I("check", 8, 8, 16, "onAccent"),
      E(124, 0, 32, 32, { f: "surface", s: "accent", sw: 2 }),
      T("2", 140, 16, 13, "accent", "middle"),
      E(248, 0, 32, 32, { f: "surface", s: "border" }),
      T("3", 264, 16, 13, "muted", "middle"),
      T("Account", 16, 46, 11, "muted", "middle"),
      T("Details", 140, 46, 11, "text", "middle"),
      T("Done", 264, 46, 11, "muted", "middle"),
    ],
    "wizard",
  ),
  // overlays
  c(
    "menu",
    "Dropdown menu",
    "Overlays",
    200,
    152,
    () => {
      const out: Shape[] = [
        R(0, 0, 200, 152, { r: "ctl", f: "surface", s: "border" }),
      ];
      [
        ["pencil", "Rename"],
        ["copy", "Duplicate"],
        ["share", "Share"],
        ["trash", "Delete"],
      ].forEach(([ic, lb], k) =>
        out.push(
          I(ic, 14, 12 + k * 34, 20, k === 3 ? "danger" : "muted"),
          T(lb, 46, 22 + k * 34, 14, k === 3 ? "danger" : "text"),
        ),
      );
      return out;
    },
    "context popover",
  ),
  c(
    "dialog",
    "Dialog",
    "Overlays",
    320,
    180,
    () => [
      R(0, 0, 320, 180, { r: "card", f: "surface", s: "border" }),
      T("Delete collection?", 20, 32, 17),
      T("This cannot be undone.", 20, 62, 13, "muted"),
      R(112, 124, 90, 40, { r: "ctl", f: "surfaceAlt", s: "border" }),
      T("Cancel", 157, 144, 13, "text", "middle"),
      R(210, 124, 90, 40, { r: "ctl", f: "danger", s: null }),
      T("Delete", 255, 144, 13, "onAccent", "middle"),
    ],
    "modal confirm",
  ),
  c("sheet", "Bottom sheet", "Overlays", 360, 200, () => [
    R(0, 0, 360, 200, { r: "card", f: "surface", s: "border" }),
    R(150, 10, 60, 5, { r: 3, f: "border", s: null }),
    T("Add to…", 20, 44, 16),
    I("layers", 20, 70, 22, "accent"),
    T("Queue", 56, 81, 14),
    I("heart", 20, 108, 22, "accent"),
    T("Favourites", 56, 119, 14),
    I("folder-plus", 20, 146, 22, "accent"),
    T("New collection", 56, 157, 14),
  ]),
  // screens
  c(
    "phone",
    "Phone screen",
    "Screens",
    360,
    720,
    () => [
      R(0, 0, 360, 720, { r: 36, f: "page", s: "border", sw: 2 }),
      R(130, 12, 100, 6, { r: 3, f: "border", s: null }),
    ],
    "mobile frame",
  ),
  c(
    "browser",
    "Browser window",
    "Screens",
    800,
    500,
    () => [
      R(0, 0, 800, 500, { r: "card", f: "page", s: "border", sw: 2 }),
      R(0, 0, 800, 44, { r: 0, f: "surface", s: null }),
      E(16, 16, 12, 12, { f: "danger", s: null }),
      E(36, 16, 12, 12, { f: "accent", s: null }),
      E(56, 16, 12, 12, { f: "success", s: null }),
      R(96, 8, 520, 28, { r: "ctl", f: "surfaceAlt", s: null }),
      T("example.com", 112, 22, 12, "muted"),
    ],
    "desktop window",
  ),
];

function shift(s: Shape, dx: number): Shape {
  if (s.t === "line") {
    return {
      ...s,
      pts: s.pts.map(([x, y]) => [x + dx, y] as [number, number]),
    };
  }
  return { ...s, x: (s as any).x + dx } as Shape;
}

export const COMPONENTS: readonly ComponentDef[] = [
  ...PARAMETRIC,
  ...BASIC.filter((x) => !REPLACED.has(x.id)),
];

export const getComponent = (id: string) => COMPONENTS.find((x) => x.id === id);
