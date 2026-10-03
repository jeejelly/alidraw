import { actionCopyAsMermaid } from "../../../actions";
import { t } from "../../../i18n";
import {
  ImageIcon,
  EmbedIcon,
  LassoIcon,
  bucketFillIcon,
  drawShapeToolIcon,
  frameToolIcon,
  laserPointerToolIcon,
  mermaidLogoIcon,
  knifeToolIcon,
  pathToolIcon,
  handIcon,
  SelectionIcon,
  RectangleIcon,
  DiamondIcon,
  EllipseIcon,
  ArrowIcon,
  LineIcon,
  FreedrawIcon,
  TextIcon,
  EraserIcon,
  stickyNoteToolIcon,
  UnlockedIcon,
} from "../../icons";

import type App from "../../App";

export type ToolEntry = {
  id: string;
  icon: React.ReactNode;
  title: string;
  shortcut?: string;
  /** a tool to activate, or something else to open */
  run: (app: App) => void;
  tool?: string;
};

/** An entry that just activates the tool named like its id. */
const activating = (
  id: string,
  icon: React.ReactNode,
  title: string,
  shortcut?: string,
): ToolEntry => ({
  id,
  icon,
  title,
  shortcut,
  tool: id,
  run: (app) => app.setActiveTool({ type: id as any }),
});

// built on use so titles follow the current language
export const getToolEntries = (): ToolEntry[] => [
  {
    id: "lock",
    icon: UnlockedIcon,
    title: t("toolBar.lock"),
    shortcut: "Q",
    run: (app) => app.toggleLock("ui"),
  },
  activating("hand", handIcon, t("toolBar.hand"), "H"),
  activating("selection", SelectionIcon, t("toolBar.selection"), "V"),
  activating("rectangle", RectangleIcon, t("toolBar.rectangle"), "R"),
  activating("diamond", DiamondIcon, t("toolBar.diamond"), "D"),
  activating("ellipse", EllipseIcon, t("toolBar.ellipse"), "O"),
  activating("arrow", ArrowIcon, t("toolBar.arrow"), "A"),
  activating("line", LineIcon, t("toolBar.line"), "L"),
  activating("freedraw", FreedrawIcon, t("toolBar.freedraw"), "X"),
  activating("text", TextIcon, t("toolBar.text"), "T"),
  activating("stickynote", stickyNoteToolIcon, t("toolBar.stickynote"), "N"),
  activating("eraser", EraserIcon, t("toolBar.eraser"), "E"),
  activating("image", ImageIcon, t("toolBar.image"), "9"),
  activating("frame", frameToolIcon, t("toolBar.frame"), "F"),
  activating("embeddable", EmbedIcon, t("toolBar.embeddable")),
  activating("autoshape", drawShapeToolIcon, t("toolBar.autoshape"), "Shift+X"),
  activating("laser", laserPointerToolIcon, t("toolBar.laser"), "K"),
  activating("bucketfill", bucketFillIcon, t("toolBar.bucketfill"), "B"),
  activating("path", pathToolIcon, t("toolBar.path"), "P"),
  activating("knife", knifeToolIcon, t("toolBar.knife"), "C"),
  activating("lasso", LassoIcon, t("toolBar.lasso")),
  {
    id: "mermaid-from",
    icon: mermaidLogoIcon,
    title: t("labels.mermaid.from"),
    run: (app) => app.setOpenDialog({ name: "ttd", tab: "mermaid" }),
  },
  {
    id: "mermaid-to",
    icon: <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>→M</span>,
    title: t("labels.mermaid.to"),
    run: (app) => app.actionManager.executeAction(actionCopyAsMermaid, "ui"),
  },
];
