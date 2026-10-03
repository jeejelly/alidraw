import {
  defineComponent,
  ellipseShape,
  iconShape,
  lineShape,
  rectShape,
  textShape,
  type ComponentDef,
  type Shape,
} from "../shapes";

export const NAVIGATION_COMPONENTS: readonly ComponentDef[] = [
  // navigation
  defineComponent("tabs", "Tabs", "Navigation", 300, 44, () => [
    textShape("All", 50, 20, 14, "accent", "middle"),
    textShape("Saved", 150, 20, 14, "muted", "middle"),
    textShape("Recent", 250, 20, 14, "muted", "middle"),
    rectShape(0, 42, 300, 1, { f: "border", s: null }),
    rectShape(10, 40, 80, 3, { r: 1, f: "accent", s: null }),
  ]),
  defineComponent(
    "segmented",
    "Segmented control",
    "Navigation",
    240,
    40,
    () => [
      rectShape(0, 0, 240, 40, { r: "ctl", f: "surfaceAlt", s: null }),
      rectShape(4, 4, 76, 32, { r: "ctl", f: "surface", s: "border" }),
      textShape("Day", 42, 20, 13, "text", "middle"),
      textShape("Week", 120, 20, 13, "muted", "middle"),
      textShape("Month", 198, 20, 13, "muted", "middle"),
    ],
  ),
  defineComponent(
    "navbar",
    "Top bar",
    "Navigation",
    360,
    56,
    () => [
      rectShape(0, 0, 360, 56, { r: 0, f: "surface", s: null }),
      textShape("My app", 16, 28, 18),
      rectShape(250, 8, 40, 40, { r: "pill", f: "accent", s: null }),
      iconShape("download", 260, 18, 20, "onAccent"),
      rectShape(300, 8, 40, 40, { r: "pill", f: "accent", s: null }),
      iconShape("folder-plus", 310, 18, 20, "onAccent"),
    ],
    "header app bar",
  ),
  defineComponent(
    "bottom-nav",
    "Bottom navigation",
    "Navigation",
    360,
    64,
    () => {
      const out: Shape[] = [
        rectShape(0, 0, 360, 64, { r: 0, f: "surface", s: null }),
        rectShape(0, 0, 360, 1, { f: "border", s: null }),
      ];
      [
        ["home", "Home"],
        ["search", "Search"],
        ["heart", "Saved"],
        ["user", "Profile"],
      ].forEach(([ic, lb], index) => {
        const x = 45 + index * 90;
        out.push(
          iconShape(ic, x - 11, 10, 22, index === 0 ? "accent" : "muted"),
          textShape(lb, x, 46, 11, index === 0 ? "accent" : "muted", "middle"),
        );
      });
      return out;
    },
    "tab bar",
  ),
  defineComponent("sidebar", "Sidebar", "Navigation", 220, 260, () => {
    const out: Shape[] = [
      rectShape(0, 0, 220, 260, { r: 0, f: "surface", s: "border" }),
      textShape("Workspace", 16, 28, 15),
    ];
    [
      ["home", "Overview"],
      ["layers", "Projects"],
      ["users", "Team"],
      ["settings", "Settings"],
    ].forEach(([ic, lb], index) => {
      const y = 56 + index * 48;
      if (index === 0) {
        out.push(
          rectShape(8, y, 204, 40, { r: "ctl", f: "surfaceAlt", s: null }),
        );
      }
      out.push(
        iconShape(ic, 20, y + 8, 24, index === 0 ? "accent" : "muted"),
        textShape(lb, 56, y + 20, 14, index === 0 ? "text" : "muted"),
      );
    });
    return out;
  }),
  defineComponent("breadcrumb", "Breadcrumb", "Navigation", 260, 24, () => [
    textShape("Home", 0, 12, 13, "muted"),
    iconShape("chevron-right", 40, 4, 16, "muted"),
    textShape("Library", 60, 12, 13, "muted"),
    iconShape("chevron-right", 112, 4, 16, "muted"),
    textShape("Collections", 132, 12, 13),
  ]),
  defineComponent("pagination", "Pagination", "Navigation", 260, 36, () => [
    rectShape(0, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
    iconShape("chevron-left", 8, 8, 20, "muted"),
    rectShape(44, 0, 36, 36, { r: "ctl", f: "accent", s: null }),
    textShape("1", 62, 18, 13, "onAccent", "middle"),
    rectShape(88, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
    textShape("2", 106, 18, 13, "text", "middle"),
    rectShape(132, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
    textShape("3", 150, 18, 13, "text", "middle"),
    rectShape(176, 0, 36, 36, { r: "ctl", f: "surface", s: "border" }),
    iconShape("chevron-right", 184, 8, 20, "muted"),
  ]),
  defineComponent(
    "steps",
    "Step indicator",
    "Navigation",
    280,
    56,
    () => [
      lineShape(
        [
          [16, 16],
          [140, 16],
        ],
        { s: "accent", sw: 2 },
      ),
      lineShape(
        [
          [140, 16],
          [264, 16],
        ],
        { s: "border", sw: 2 },
      ),
      ellipseShape(0, 0, 32, 32, { f: "accent", s: null }),
      iconShape("check", 8, 8, 16, "onAccent"),
      ellipseShape(124, 0, 32, 32, { f: "surface", s: "accent", sw: 2 }),
      textShape("2", 140, 16, 13, "accent", "middle"),
      ellipseShape(248, 0, 32, 32, { f: "surface", s: "border" }),
      textShape("3", 264, 16, 13, "muted", "middle"),
      textShape("Account", 16, 46, 11, "muted", "middle"),
      textShape("Details", 140, 46, 11, "text", "middle"),
      textShape("Done", 264, 46, 11, "muted", "middle"),
    ],
    "wizard",
  ),
  // overlays
  defineComponent(
    "menu",
    "Dropdown menu",
    "Overlays",
    200,
    152,
    () => {
      const out: Shape[] = [
        rectShape(0, 0, 200, 152, { r: "ctl", f: "surface", s: "border" }),
      ];
      [
        ["pencil", "Rename"],
        ["copy", "Duplicate"],
        ["share", "Share"],
        ["trash", "Delete"],
      ].forEach(([ic, lb], index) =>
        out.push(
          iconShape(
            ic,
            14,
            12 + index * 34,
            20,
            index === 3 ? "danger" : "muted",
          ),
          textShape(
            lb,
            46,
            22 + index * 34,
            14,
            index === 3 ? "danger" : "text",
          ),
        ),
      );
      return out;
    },
    "context popover",
  ),
  defineComponent(
    "dialog",
    "Dialog",
    "Overlays",
    320,
    180,
    () => [
      rectShape(0, 0, 320, 180, { r: "card", f: "surface", s: "border" }),
      textShape("Delete collection?", 20, 32, 17),
      textShape("This cannot be undone.", 20, 62, 13, "muted"),
      rectShape(112, 124, 90, 40, { r: "ctl", f: "surfaceAlt", s: "border" }),
      textShape("Cancel", 157, 144, 13, "text", "middle"),
      rectShape(210, 124, 90, 40, { r: "ctl", f: "danger", s: null }),
      textShape("Delete", 255, 144, 13, "onAccent", "middle"),
    ],
    "modal confirm",
  ),
  defineComponent("sheet", "Bottom sheet", "Overlays", 360, 200, () => [
    rectShape(0, 0, 360, 200, { r: "card", f: "surface", s: "border" }),
    rectShape(150, 10, 60, 5, { r: 3, f: "border", s: null }),
    textShape("Add to…", 20, 44, 16),
    iconShape("layers", 20, 70, 22, "accent"),
    textShape("Queue", 56, 81, 14),
    iconShape("heart", 20, 108, 22, "accent"),
    textShape("Favourites", 56, 119, 14),
    iconShape("folder-plus", 20, 146, 22, "accent"),
    textShape("New collection", 56, 157, 14),
  ]),
  // screens
  defineComponent(
    "phone",
    "Phone screen",
    "Screens",
    360,
    720,
    () => [
      rectShape(0, 0, 360, 720, { r: 36, f: "page", s: "border", sw: 2 }),
      rectShape(130, 12, 100, 6, { r: 3, f: "border", s: null }),
    ],
    "mobile frame",
  ),
  defineComponent(
    "browser",
    "Browser window",
    "Screens",
    800,
    500,
    () => [
      rectShape(0, 0, 800, 500, { r: "card", f: "page", s: "border", sw: 2 }),
      rectShape(0, 0, 800, 44, { r: 0, f: "surface", s: null }),
      ellipseShape(16, 16, 12, 12, { f: "danger", s: null }),
      ellipseShape(36, 16, 12, 12, { f: "accent", s: null }),
      ellipseShape(56, 16, 12, 12, { f: "success", s: null }),
      rectShape(96, 8, 520, 28, { r: "ctl", f: "surfaceAlt", s: null }),
      textShape("example.com", 112, 22, 12, "muted"),
    ],
    "desktop window",
  ),
];
