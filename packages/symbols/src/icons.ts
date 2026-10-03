import { circle, dot, rrect, star, ticks } from "@excalidraw/vector";

/** Outline icons on a 24 x 24 grid as plain path data (one stroke colour, no fills). */
export type IconDef = {
  name: string;
  category: IconCategory;
  d: string;
  tags?: string;
};

export type IconCategory =
  | "General"
  | "Arrows"
  | "Communication"
  | "Media"
  | "Commerce"
  | "Devices"
  | "Files & data"
  | "Status";

export const ICON_CATEGORIES: readonly IconCategory[] = [
  "General",
  "Arrows",
  "Communication",
  "Media",
  "Commerce",
  "Devices",
  "Files & data",
  "Status",
];

const defineIcon = (
  name: string,
  category: IconCategory,
  path: string,
  tags = "",
): IconDef => ({ name, category, d: path, tags });

const eye =
  "M2 12C5 6.5 8.5 5 12 5C15.5 5 19 6.5 22 12C19 17.5 15.5 19 12 19C8.5 19 5 17.5 2 12Z";

export const ICONS: readonly IconDef[] = [
  // general
  defineIcon(
    "home",
    "General",
    "M3 11L12 4L21 11M5 10V20H19V10M10 20V14H14V20",
    "house",
  ),
  defineIcon(
    "search",
    "General",
    `${circle(10.5, 10.5, 6.5)}M15.5 15.5L21 21`,
    "find magnifier",
  ),
  defineIcon("menu", "General", "M4 6H20M4 12H20M4 18H20", "hamburger"),
  defineIcon("close", "General", "M6 6L18 18M18 6L6 18", "x cancel"),
  defineIcon("plus", "General", "M12 5V19M5 12H19", "add new"),
  defineIcon("minus", "General", "M5 12H19", "remove"),
  defineIcon("check", "General", "M5 12.5L10 17.5L19 7", "ok done tick"),
  defineIcon(
    "settings",
    "General",
    `${circle(12, 12, 3)}${circle(12, 12, 7.2)}${ticks(12, 12, 7.2, 10, 8)}`,
    "gear cog",
  ),
  defineIcon(
    "sliders",
    "General",
    `M4 7H20M4 17H20${circle(9, 7, 2.5)}${circle(15, 17, 2.5)}`,
    "settings adjust",
  ),
  defineIcon(
    "user",
    "General",
    `${circle(12, 8, 4)}M4 20C4 15.5 7.5 14 12 14C16.5 14 20 15.5 20 20`,
    "person profile",
  ),
  defineIcon(
    "users",
    "General",
    `${circle(
      9,
      8,
      3.5,
    )}M2.5 19C2.5 15.5 5 14 9 14C13 14 15.5 15.5 15.5 19${circle(
      17,
      9,
      2.8,
    )}M17 14C20 14 21.5 15.5 21.5 19`,
    "people group",
  ),
  defineIcon(
    "heart",
    "General",
    "M12 20C4 14.5 3 9.5 6 6.5C8.5 4.2 11 5.5 12 7.5C13 5.5 15.5 4.2 18 6.5C21 9.5 20 14.5 12 20Z",
    "like favourite",
  ),
  defineIcon("star", "General", star(12, 12.5, 9, 4), "favorite rating"),
  defineIcon(
    "bell",
    "General",
    "M6 17C6 17 7 15 7 11C7 7.5 9 5.5 12 5.5C15 5.5 17 7.5 17 11C17 15 18 17 18 17ZM10 20C10.5 21 13.5 21 14 20M12 5.5V4",
    "notification alarm",
  ),
  defineIcon("bookmark", "General", "M7 4H17V20L12 16L7 20Z", "save"),
  defineIcon(
    "tag",
    "General",
    `M12.5 3.5H20.5V11.5L11.5 20.5L3.5 12.5Z${circle(16.5, 7.5, 1.2)}`,
    "label price",
  ),
  defineIcon("flag", "General", "M5 21V4M5 5H18L15 9L18 13H5", "report"),
  defineIcon(
    "trash",
    "General",
    "M4 7H20M9 7V4H15V7M6 7L7 20H17L18 7M10 11V16M14 11V16",
    "delete bin",
  ),
  defineIcon(
    "pencil",
    "General",
    "M4 20L5 15L16 4L20 8L9 19ZM14 6L18 10",
    "edit write",
  ),
  defineIcon("eye", "General", `${eye}${circle(12, 12, 3)}`, "view show"),
  defineIcon(
    "eye-off",
    "General",
    `${eye}${circle(12, 12, 3)}M4 4L20 20`,
    "hide",
  ),
  defineIcon(
    "lock",
    "General",
    `${rrect(
      5,
      11,
      14,
      10,
      2,
    )}M8 11V8C8 5.5 9.8 4 12 4C14.2 4 16 5.5 16 8V11M12 15V17`,
    "secure",
  ),
  defineIcon(
    "unlock",
    "General",
    `${rrect(
      5,
      11,
      14,
      10,
      2,
    )}M8 11V8C8 5.5 9.8 4 12 4C14.2 4 16 5.5 16 7M12 15V17`,
    "open",
  ),
  defineIcon(
    "key",
    "General",
    `${circle(8, 15, 4)}M11 12L20 3M16 7L19 10`,
    "password",
  ),
  defineIcon(
    "link",
    "General",
    "M10 14C8 12 8 9 10 7L13 4C15 2 18 2 20 4C22 6 22 9 20 11L18.5 12.5M14 10C16 12 16 15 14 17L11 20C9 22 6 22 4 20C2 18 2 15 4 13L5.5 11.5",
    "chain url",
  ),
  defineIcon(
    "share",
    "General",
    `${circle(6, 12, 2.5)}${circle(18, 5.5, 2.5)}${circle(
      18,
      18.5,
      2.5,
    )}M8.2 10.8L15.8 6.7M8.2 13.2L15.8 17.3`,
    "send",
  ),
  defineIcon("filter", "General", "M3 5H21L14 13V20L10 18V13Z", "funnel"),
  defineIcon(
    "grid",
    "General",
    `${rrect(4, 4, 6.5, 6.5, 1.5)}${rrect(13.5, 4, 6.5, 6.5, 1.5)}${rrect(
      4,
      13.5,
      6.5,
      6.5,
      1.5,
    )}${rrect(13.5, 13.5, 6.5, 6.5, 1.5)}`,
    "apps tiles",
  ),
  defineIcon(
    "list",
    "General",
    `M9 6H20M9 12H20M9 18H20${dot(4.5, 6)}${dot(4.5, 12)}${dot(4.5, 18)}`,
    "rows",
  ),
  defineIcon(
    "more",
    "General",
    `${dot(5, 12, 1.1)}${dot(12, 12, 1.1)}${dot(19, 12, 1.1)}`,
    "ellipsis dots horizontal",
  ),
  defineIcon(
    "more-vertical",
    "General",
    `${dot(12, 5, 1.1)}${dot(12, 12, 1.1)}${dot(12, 19, 1.1)}`,
    "dots kebab",
  ),
  defineIcon(
    "layers",
    "General",
    "M12 3L21 8L12 13L3 8ZM3 12.5L12 17.5L21 12.5M3 16.5L12 21.5L21 16.5",
    "stack",
  ),
  defineIcon(
    "cube",
    "General",
    "M12 3L20.5 7.5V16.5L12 21L3.5 16.5V7.5ZM3.5 7.5L12 12L20.5 7.5M12 12V21",
    "box 3d",
  ),
  defineIcon(
    "palette",
    "General",
    `M12 3C7 3 3 7 3 12C3 17 7 21 12 21C13.5 21 14 20 13.5 19C13 18 13.5 16.5 15 16.5H17C19.5 16.5 21 15 21 12.5C21 7.5 17 3 12 3Z${dot(
      7.5,
      11,
    )}${dot(10, 7)}${dot(15, 7.5)}`,
    "colour paint",
  ),
  defineIcon("type", "General", "M5 6V4.5H19V6M12 4.5V20M9 20H15", "text font"),
  defineIcon("cursor", "General", "M5 3L19 11L12 13L9.5 20Z", "pointer select"),
  defineIcon(
    "code",
    "General",
    "M8 7L3 12L8 17M16 7L21 12L16 17M13.5 5L10.5 19",
    "develop",
  ),
  defineIcon(
    "thumbs-up",
    "General",
    "M7 11V20H4V11ZM7 11L11 4C13 4 14 5.5 13.5 7.5L13 9.5H19C20 9.5 20.7 10.5 20.5 11.5L19 18.5C18.8 19.4 18 20 17 20H7",
    "like",
  ),
  defineIcon(
    "smile",
    "General",
    `${circle(12, 12, 9)}M8.5 14C9.5 15.8 14.5 15.8 15.5 14${dot(
      9,
      10,
      0.7,
    )}${dot(15, 10, 0.7)}`,
    "emoji happy",
  ),
  defineIcon(
    "sun",
    "General",
    `${circle(12, 12, 4)}${ticks(12, 12, 6.8, 9.5, 8)}`,
    "light mode",
  ),
  defineIcon(
    "moon",
    "General",
    "M20 14.5C19 15 17.8 15.3 16.5 15.3C12.4 15.3 9 12 9 7.8C9 6.4 9.4 5.2 10 4C6.5 5 4 8.2 4 12C4 16.7 7.8 20.5 12.5 20.5C16 20.5 19 18.4 20 14.5Z",
    "dark mode night",
  ),
  defineIcon(
    "bolt",
    "General",
    "M13 3L5 13.5H11.5L10.5 21L19 10H12.5Z",
    "flash power",
  ),
  defineIcon(
    "move",
    "General",
    "M12 3V21M3 12H21M9 6L12 3L15 6M9 18L12 21L15 18M6 9L3 12L6 15M18 9L21 12L18 15",
    "drag",
  ),
  // arrows
  defineIcon("arrow-right", "Arrows", "M4 12H20M14 6L20 12L14 18"),
  defineIcon("arrow-left", "Arrows", "M20 12H4M10 6L4 12L10 18"),
  defineIcon("arrow-up", "Arrows", "M12 20V4M6 10L12 4L18 10"),
  defineIcon("arrow-down", "Arrows", "M12 4V20M6 14L12 20L18 14"),
  defineIcon("chevron-right", "Arrows", "M9 5L16 12L9 19", "next"),
  defineIcon("chevron-left", "Arrows", "M15 5L8 12L15 19", "back previous"),
  defineIcon("chevron-up", "Arrows", "M5 15L12 8L19 15", "collapse"),
  defineIcon("chevron-down", "Arrows", "M5 9L12 16L19 9", "expand dropdown"),
  defineIcon(
    "chevrons-right",
    "Arrows",
    "M6 6L12 12L6 18M13 6L19 12L13 18",
    "skip",
  ),
  defineIcon(
    "download",
    "Arrows",
    "M12 4V15M7 10.5L12 15.5L17 10.5M4 20H20",
    "save import",
  ),
  defineIcon(
    "upload",
    "Arrows",
    "M12 16V5M7 9.5L12 4.5L17 9.5M4 20H20",
    "export",
  ),
  defineIcon(
    "refresh",
    "Arrows",
    "M20 12C20 16.4 16.4 20 12 20C8.6 20 5.7 17.9 4.5 15M4 12C4 7.6 7.6 4 12 4C15.4 4 18.3 6.1 19.5 9M20 4V9H15M4 20V15H9",
    "reload sync",
  ),
  defineIcon("undo", "Arrows", "M9 8L4 13L9 18M4 13H15C18 13 20 15 20 17.5"),
  defineIcon(
    "external",
    "Arrows",
    "M14 4H20V10M20 4L11 13M18 14V19C18 19.6 17.6 20 17 20H5C4.4 20 4 19.6 4 19V7C4 6.4 4.4 6 5 6H10",
    "open new window",
  ),
  defineIcon(
    "logout",
    "Arrows",
    "M10 4H5V20H10M15 8L19 12L15 16M19 12H9",
    "sign out",
  ),
  defineIcon(
    "login",
    "Arrows",
    "M14 4H19V20H14M9 8L5 12L9 16M5 12H15",
    "sign in",
  ),
  defineIcon(
    "swap",
    "Arrows",
    "M4 8H19M15 4L19 8L15 12M20 16H5M9 12L5 16L9 20",
    "exchange",
  ),
  // communication
  defineIcon(
    "mail",
    "Communication",
    `${rrect(3, 5.5, 18, 13, 2)}M3.5 7L12 13.5L20.5 7`,
    "email",
  ),
  defineIcon(
    "phone",
    "Communication",
    "M6 3H10L11.5 8L9 9.5C10 12 12 14 14.5 15L16 12.5L21 14V18C21 19.5 19.5 21 18 21C10 20.5 3.5 14 3 6C3 4.5 4.5 3 6 3Z",
    "call",
  ),
  defineIcon(
    "chat",
    "Communication",
    "M4 5H20V16H11L6.5 20V16H4Z",
    "message comment",
  ),
  defineIcon(
    "send",
    "Communication",
    "M21 3L10 14M21 3L14.5 21L10 14L3 9.5Z",
    "paper plane",
  ),
  defineIcon(
    "paperclip",
    "Communication",
    "M17 11L10 18C8 20 5 19 4.5 16.5C4.2 15 5 14 6 13L14 5C15.5 3.5 18 4 18.8 6C19.4 7.6 18.8 8.8 17.8 9.8L9.5 18",
    "attach",
  ),
  defineIcon(
    "at",
    "Communication",
    `${circle(
      12,
      12,
      4,
    )}M16 8V13C16 15 18.5 15 19.5 13C21 10 20 4 12 3.5C6 3.5 3 8 4 13C5 18 10 20.5 15 19`,
    "mention",
  ),
  defineIcon(
    "globe",
    "Communication",
    `${circle(12, 12, 9)}M3 12H21M12 3C8 7 8 17 12 21M12 3C16 7 16 17 12 21`,
    "web world language",
  ),
  defineIcon(
    "map-pin",
    "Communication",
    `M12 21C12 21 5 14.5 5 9.5C5 5.6 8.1 3 12 3C15.9 3 19 5.6 19 9.5C19 14.5 12 21 12 21Z${circle(
      12,
      9.5,
      2.5,
    )}`,
    "location place",
  ),
  // media
  defineIcon("play", "Media", "M7 4.5L19 12L7 19.5Z"),
  defineIcon(
    "pause",
    "Media",
    `${rrect(6, 5, 4, 14, 1)}${rrect(14, 5, 4, 14, 1)}`,
  ),
  defineIcon("stop", "Media", rrect(5.5, 5.5, 13, 13, 2)),
  defineIcon("skip-next", "Media", "M6 5L15 12L6 19ZM18 5V19"),
  defineIcon("skip-back", "Media", "M18 5L9 12L18 19ZM6 5V19"),
  defineIcon(
    "volume",
    "Media",
    "M4 9.5H8L13 5V19L8 14.5H4ZM16.5 9C18 10.5 18 13.5 16.5 15M19 6.5C22 9.5 22 14.5 19 17.5",
    "sound speaker",
  ),
  defineIcon(
    "mute",
    "Media",
    "M4 9.5H8L13 5V19L8 14.5H4ZM16 9.5L21 14.5M21 9.5L16 14.5",
    "silent",
  ),
  defineIcon(
    "mic",
    "Media",
    `${rrect(
      9,
      3,
      6,
      11,
      3,
    )}M5.5 11C5.5 15 8.5 17.5 12 17.5C15.5 17.5 18.5 15 18.5 11M12 17.5V21M9 21H15`,
    "microphone record",
  ),
  defineIcon(
    "music",
    "Media",
    `M9 18V5L19 3V16${circle(6.5, 18, 2.5)}${circle(16.5, 16, 2.5)}`,
    "note audio",
  ),
  defineIcon(
    "image",
    "Media",
    `${rrect(3, 4.5, 18, 15, 2)}${circle(
      8.5,
      9.5,
      1.6,
    )}M3.5 17L9 12L13 16L16 13L20.5 17.5`,
    "picture photo",
  ),
  defineIcon(
    "camera",
    "Media",
    `M3 8H7L9 5H15L17 8H21V19H3Z${circle(12, 13, 3.5)}`,
    "photo",
  ),
  defineIcon(
    "video",
    "Media",
    `${rrect(3, 6, 13, 12, 2)}M16 10.5L21 7.5V16.5L16 13.5`,
    "film",
  ),
  defineIcon(
    "playlist",
    "Media",
    "M4 6H16M4 11H16M4 16H10M14 15L20 18.5L14 22Z",
    "queue",
  ),
  defineIcon(
    "shuffle",
    "Media",
    "M3 7H7C11 7 12 17 16 17H21M3 17H7C8.5 17 9.5 15.5 10.5 14M13.5 10C14.5 8.5 15 7 16 7H21M18 4L21 7L18 10M18 14L21 17L18 20",
    "random",
  ),
  defineIcon(
    "repeat",
    "Media",
    "M4 11V9C4 7.9 4.9 7 6 7H20M17 4L20 7L17 10M20 13V15C20 16.1 19.1 17 18 17H4M7 14L4 17L7 20",
    "loop",
  ),
  // commerce
  defineIcon(
    "cart",
    "Commerce",
    `M2.5 4H5.5L8 15.5H18.5L20.5 7.5H6.5${circle(10, 19.3, 1.3)}${circle(
      17,
      19.3,
      1.3,
    )}`,
    "basket shop",
  ),
  defineIcon(
    "credit-card",
    "Commerce",
    `${rrect(2.5, 5, 19, 14, 2)}M2.5 10H21.5M6 15H10`,
    "payment",
  ),
  defineIcon(
    "bag",
    "Commerce",
    "M5 8H19L20 20H4ZM8.5 8V6.5C8.5 4.5 10 3.5 12 3.5C14 3.5 15.5 4.5 15.5 6.5V8",
    "shopping",
  ),
  defineIcon(
    "gift",
    "Commerce",
    `${rrect(3.5, 10, 17, 10.5, 1.5)}${rrect(
      2.5,
      6.5,
      19,
      3.5,
      1,
    )}M12 6.5V20.5M12 6.5C12 6.5 10 3 8 4C6.5 5 7.5 6.5 12 6.5M12 6.5C12 6.5 14 3 16 4C17.5 5 16.5 6.5 12 6.5`,
    "present",
  ),
  defineIcon(
    "chart-bar",
    "Commerce",
    "M3 4V20H21M7.5 17V12M12 17V7M16.5 17V10",
    "stats analytics",
  ),
  defineIcon(
    "chart-line",
    "Commerce",
    "M3 4V20H21M6.5 15L11 10L14 13L20 6.5",
    "trend graph",
  ),
  defineIcon(
    "chart-pie",
    "Commerce",
    `${circle(12, 12, 9)}M12 3V12H21`,
    "donut",
  ),
  defineIcon(
    "wallet",
    "Commerce",
    `M4 7C4 5.9 4.9 5 6 5H18V8M4 7V18C4 19.1 4.9 20 6 20H20V8H6C4.9 8 4 7.1 4 7Z${dot(
      16,
      14,
      1.2,
    )}`,
    "money",
  ),
  // devices
  defineIcon(
    "laptop",
    "Devices",
    `${rrect(5, 5, 14, 10, 1.5)}M2.5 18.5H21.5`,
    "computer",
  ),
  defineIcon(
    "mobile",
    "Devices",
    `${rrect(7, 2.5, 10, 19, 2.5)}M11 18.5H13`,
    "phone",
  ),
  defineIcon(
    "monitor",
    "Devices",
    `${rrect(3, 4, 18, 12, 2)}M9 20H15M12 16V20`,
    "desktop screen",
  ),
  defineIcon(
    "wifi",
    "Devices",
    `M2.5 9C8 4 16 4 21.5 9M5.5 12.5C9 9.5 15 9.5 18.5 12.5M8.5 16C10.5 14.3 13.5 14.3 15.5 16${dot(
      12,
      19,
      1,
    )}`,
    "network",
  ),
  defineIcon(
    "battery",
    "Devices",
    `${rrect(2.5, 7.5, 17, 9, 2)}M21.5 10.5V13.5${rrect(5, 10, 8, 4, 0.5)}`,
    "power",
  ),
  defineIcon(
    "bluetooth",
    "Devices",
    "M7 7L17 17L12 21V3L17 7L7 17",
    "wireless",
  ),
  defineIcon(
    "cpu",
    "Devices",
    `${rrect(6, 6, 12, 12, 2)}${rrect(
      9.5,
      9.5,
      5,
      5,
      1,
    )}M9 3V6M15 3V6M9 18V21M15 18V21M3 9H6M3 15H6M18 9H21M18 15H21`,
    "chip processor",
  ),
  defineIcon(
    "server",
    "Devices",
    `${rrect(3, 4, 18, 6.5, 1.5)}${rrect(3, 13.5, 18, 6.5, 1.5)}${dot(
      7,
      7.25,
    )}${dot(7, 16.75)}`,
  ),
  defineIcon(
    "terminal",
    "Devices",
    `${rrect(3, 4.5, 18, 15, 2)}M7 10L10 12.5L7 15M12.5 15.5H17`,
    "console",
  ),
  defineIcon(
    "cloud",
    "Devices",
    "M7 18C4.2 18 2.5 16.2 2.5 14C2.5 11.8 4.3 10.2 6.3 10.1C6.8 7.3 9.2 5.5 12 5.5C15 5.5 17.3 7.6 17.7 10.4C20 10.6 21.5 12.2 21.5 14.2C21.5 16.3 19.8 18 17.5 18Z",
    "storage",
  ),
  // files
  defineIcon(
    "document",
    "Files & data",
    "M6 3H14L19 8V21H6ZM14 3V8H19M9 13H16M9 17H16",
    "file page",
  ),
  defineIcon(
    "folder",
    "Files & data",
    "M3 6.5C3 5.7 3.7 5 4.5 5H9.5L11.5 7.5H19.5C20.3 7.5 21 8.2 21 9V18C21 18.8 20.3 19.5 19.5 19.5H4.5C3.7 19.5 3 18.8 3 18Z",
    "directory",
  ),
  defineIcon(
    "folder-plus",
    "Files & data",
    "M3 6.5C3 5.7 3.7 5 4.5 5H9.5L11.5 7.5H19.5C20.3 7.5 21 8.2 21 9V18C21 18.8 20.3 19.5 19.5 19.5H4.5C3.7 19.5 3 18.8 3 18ZM12 11V16M9.5 13.5H14.5",
    "new folder",
  ),
  defineIcon(
    "copy",
    "Files & data",
    `${rrect(
      8.5,
      8.5,
      12,
      12,
      2,
    )}M15.5 8.5V6C15.5 4.9 14.6 4 13.5 4H6C4.9 4 4 4.9 4 6V13.5C4 14.6 4.9 15.5 6 15.5H8.5`,
    "duplicate",
  ),
  defineIcon(
    "clipboard",
    "Files & data",
    `${rrect(5, 5, 14, 16.5, 2)}${rrect(9, 2.5, 6, 4, 1)}`,
    "paste",
  ),
  defineIcon(
    "database",
    "Files & data",
    "M4 6C4 4.3 7.6 3 12 3C16.4 3 20 4.3 20 6C20 7.7 16.4 9 12 9C7.6 9 4 7.7 4 6ZM4 6V18C4 19.7 7.6 21 12 21C16.4 21 20 19.7 20 18V6M4 12C4 13.7 7.6 15 12 15C16.4 15 20 13.7 20 12",
    "storage",
  ),
  defineIcon(
    "calendar",
    "Files & data",
    `${rrect(3.5, 5, 17, 15.5, 2)}M3.5 10H20.5M8 3V7M16 3V7`,
    "date",
  ),
  defineIcon(
    "clock",
    "Files & data",
    `${circle(12, 12, 9)}M12 7V12L15.5 14`,
    "time history",
  ),
  defineIcon(
    "download-cloud",
    "Files & data",
    "M7 17C4.2 17 2.5 15.5 2.5 13.5C2.5 11.5 4.2 10 6.2 10C6.8 7.3 9 5.5 12 5.5C14.8 5.5 17 7.3 17.5 10C19.7 10 21.5 11.5 21.5 13.5C21.5 15.5 19.8 17 17.5 17M12 11V20M8.5 16.5L12 20L15.5 16.5",
    "sync",
  ),
  // status
  defineIcon("info", "Status", `${circle(12, 12, 9)}M12 11V17M12 7.5V7.6`),
  defineIcon(
    "question",
    "Status",
    `${circle(
      12,
      12,
      9,
    )}M9.5 9.5C9.5 7.5 11 6.8 12 6.8C13.5 6.8 14.7 7.8 14.5 9.3C14.3 10.8 12 11 12 13.5M12 16.5V16.6`,
    "help",
  ),
  defineIcon(
    "warning",
    "Status",
    "M12 4L21.5 20H2.5ZM12 10V14.5M12 17.2V17.3",
    "alert caution",
  ),
  defineIcon(
    "check-circle",
    "Status",
    `${circle(12, 12, 9)}M7.5 12.5L10.5 15.5L16.5 9`,
    "success",
  ),
  defineIcon(
    "x-circle",
    "Status",
    `${circle(12, 12, 9)}M9 9L15 15M15 9L9 15`,
    "error",
  ),
  defineIcon(
    "shield",
    "Status",
    "M12 3L20 6V12C20 16.5 16.5 20 12 21.5C7.5 20 4 16.5 4 12V6Z",
    "security",
  ),
  defineIcon(
    "shield-check",
    "Status",
    "M12 3L20 6V12C20 16.5 16.5 20 12 21.5C7.5 20 4 16.5 4 12V6ZM8.5 12L11 14.5L15.5 9.5",
    "verified",
  ),
  defineIcon("loader", "Status", ticks(12, 12, 5, 9, 8), "spinner busy"),
];

export const getIcon = (name: string) => ICONS.find((x) => x.name === name);
