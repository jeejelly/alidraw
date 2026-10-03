import { getIcon } from "../icons";

export const ICON_KT: Record<string, string> = {
  play: "PlayArrow",
  plus: "Add",
  search: "Search",
  menu: "Menu",
  close: "Close",
  check: "Check",
  heart: "Favorite",
  star: "Star",
  settings: "Settings",
  share: "Share",
  trash: "Delete",
  pencil: "Edit",
  "more-vertical": "MoreVert",
  "arrow-left": "ArrowBack",
  user: "Person",
  bell: "Notifications",
  home: "Home",
  "folder-plus": "CreateNewFolder",
  layers: "List",
  download: "KeyboardArrowDown",
  upload: "KeyboardArrowUp",
  lock: "Lock",
  eye: "Visibility",
  calendar: "DateRange",
  clock: "Schedule",
  info: "Info",
  warning: "Warning",
  send: "Send",
  mail: "Email",
  phone: "Call",
  "chevron-down": "KeyboardArrowDown",
  "chevron-right": "KeyboardArrowRight",
  "chevron-left": "KeyboardArrowLeft",
  "check-circle": "CheckCircle",
};
export const iconKt = (name: string) =>
  `Icons.Default.${ICON_KT[name] ?? "Info"}`;

/** an icon as inline SVG, from the library's own path data */
export const iconSvg = (name: string, size = 20) => {
  const def = getIcon(name);
  if (!def) {
    return "";
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${def.d}"/></svg>`;
};
