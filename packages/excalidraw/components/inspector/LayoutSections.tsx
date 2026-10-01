import { useState, useSyncExternalStore } from "react";

import { getCommonBounds, isPathfinderOperand } from "@excalidraw/element";

import {
  getAnchor,
  isGuideAnchor,
  ANCHOR_POINTS,
  type AnchorPoint,
  type GuideEdge,
} from "../../anchors";
import {
  actionAlignBottom,
  actionAlignHorizontallyCentered,
  actionAlignLeft,
  actionAlignRight,
  actionAlignTop,
  actionAlignVerticallyCentered,
  distributeHorizontally,
  distributeVertically,
  actionFitToGrid,
  actionToggleGridMode,
  PATHFINDER_ACTIONS,
  actionMakeCompoundShape,
  actionReleaseCompoundShape,
} from "../../actions";
import { t } from "../../i18n";
import {
  AlignLeftIcon,
  CenterHorizontallyIcon,
  AlignRightIcon,
  AlignTopIcon,
  CenterVerticallyIcon,
  AlignBottomIcon,
  DistributeHorizontallyIcon,
  DistributeVerticallyIcon,
  EdgeRoundIcon,
  ImageIcon,
  EmbedIcon,
  LassoIcon,
  bucketFillIcon,
  drawShapeToolIcon,
  frameToolIcon,
  laserPointerToolIcon,
  mermaidLogoIcon,
  EdgeSharpIcon,
  knifeToolIcon,
  pathToolIcon,
} from "../icons";

import {
  actionChangeRoundness,
  actionConvertShapeToPath,
  actionEditPath,
  actionJoinPaths,
  actionCopyAsMermaid,
} from "../../actions";

import {
  getPaletteState,
  setToolHidden,
  subscribePalette,
} from "../../palette";
import { isToolButtonDisabled } from "../Tools";

import { PathfinderIcon } from "./PathfinderIcons";
import { NumberPill, Section } from "./primitives";

import type App from "./../App";

// built on use: the actions module is still loading when this file is first read
const getAligners = () =>
  [
    [actionAlignLeft, AlignLeftIcon, "labels.alignLeft"],
    [
      actionAlignHorizontallyCentered,
      CenterHorizontallyIcon,
      "labels.centerHorizontally",
    ],
    [actionAlignRight, AlignRightIcon, "labels.alignRight"],
    [actionAlignTop, AlignTopIcon, "labels.alignTop"],
    [
      actionAlignVerticallyCentered,
      CenterVerticallyIcon,
      "labels.centerVertically",
    ],
    [actionAlignBottom, AlignBottomIcon, "labels.alignBottom"],
    [
      distributeHorizontally,
      DistributeHorizontallyIcon,
      "labels.distributeHorizontally",
    ],
    [
      distributeVertically,
      DistributeVerticallyIcon,
      "labels.distributeVertically",
    ],
  ] as const;

/** Illustrator's Align panel: six alignments and two distributions */
export const AlignSection = ({ app }: { app: App }) => {
  const count = app.scene.getSelectedElements(app.state).length;
  return (
    <Section title={t("labels.alignPanel.title")} testId="inspector-align">
      <div className="inspector__row" style={{ gap: 2, flexWrap: "wrap" }}>
        {getAligners().map(([action, icon, label]) => (
          <button
            key={label}
            type="button"
            className="inspector__iconbtn"
            style={{ width: "2rem", height: "2rem" }}
            data-testid={`align-${label.split(".")[1]}`}
            title={t(label)}
            disabled={count < (label.includes("distribute") ? 3 : 2)}
            onClick={() => app.actionManager.executeAction(action, "ui")}
          >
            {icon}
          </button>
        ))}
      </div>
    </Section>
  );
};

/** grid on/off, spacing, subdivisions, and fitting the selection to it */
export const GridSection = ({ app }: { app: App }) => {
  const { gridModeEnabled, gridSize, gridStep, gridOrigin } = app.state;
  return (
    <Section title={t("labels.grid.title")} testId="inspector-grid">
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.toggleGrid")}</span>
        <div className="inspector__seg">
          <button
            type="button"
            data-testid="grid-toggle"
            aria-pressed={gridModeEnabled}
            onClick={() =>
              app.actionManager.executeAction(actionToggleGridMode, "ui")
            }
          >
            {gridModeEnabled ? "On" : "Off"}
          </button>
        </div>
      </div>
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.grid.spacing")}</span>
        <NumberPill
          label={t("labels.grid.spacing")}
          testId="grid-spacing"
          value={gridSize}
          min={1}
          max={500}
          unit="px"
          onCommit={(v) => app.setState({ gridSize: Math.round(v) })}
        />
      </div>
      <div className="inspector__row">
        <span className="inspector__label">
          {t("labels.grid.subdivisions")}
        </span>
        <NumberPill
          label={t("labels.grid.subdivisions")}
          testId="grid-subdivisions"
          value={gridStep}
          min={1}
          max={20}
          onCommit={(v) => app.setState({ gridStep: Math.round(v) })}
        />
      </div>
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.grid.origin")}</span>
        <NumberPill
          label="X"
          testId="grid-origin-x"
          value={gridOrigin.x}
          min={-100000}
          max={100000}
          unit="px"
          onCommit={(v) =>
            app.setState({ gridOrigin: { ...gridOrigin, x: Math.round(v) } })
          }
        />
        <NumberPill
          label="Y"
          testId="grid-origin-y"
          value={gridOrigin.y}
          min={-100000}
          max={100000}
          unit="px"
          onCommit={(v) =>
            app.setState({ gridOrigin: { ...gridOrigin, y: Math.round(v) } })
          }
        />
      </div>
      <div className="inspector__row">
        <button
          type="button"
          className="inspector__text"
          style={{ cursor: "pointer" }}
          data-testid="grid-origin-selection"
          disabled={!app.scene.getSelectedElements(app.state).length}
          onClick={() => {
            const selected = app.scene.getSelectedElements(app.state);
            const [x1, y1] = getCommonBounds(selected);
            app.setState({
              gridOrigin: { x: Math.round(x1), y: Math.round(y1) },
            });
          }}
        >
          {t("labels.grid.originToSelection")}
        </button>
        <button
          type="button"
          className="inspector__text"
          style={{ cursor: "pointer" }}
          data-testid="grid-origin-reset"
          onClick={() => app.setState({ gridOrigin: { x: 0, y: 0 } })}
        >
          {t("labels.grid.originReset")}
        </button>
      </div>
      <div className="inspector__row">
        <button
          type="button"
          className="inspector__text"
          style={{ cursor: "pointer" }}
          data-testid="grid-fit"
          disabled={!app.scene.getSelectedElements(app.state).length}
          onClick={() => app.actionManager.executeAction(actionFitToGrid, "ui")}
        >
          {t("labels.grid.fit")}
        </button>
      </div>
    </Section>
  );
};

const PointPicker = ({
  value,
  onChange,
  label,
  testId,
}: {
  value: AnchorPoint;
  onChange: (p: AnchorPoint) => void;
  label: string;
  testId: string;
}) => (
  <div style={{ flex: 1 }}>
    <div style={{ opacity: 0.7, marginBottom: 4 }}>{label}</div>
    <div
      role="group"
      aria-label={label}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 3,
        width: 54,
      }}
    >
      {ANCHOR_POINTS.map((p) => (
        <button
          key={p}
          type="button"
          data-testid={`${testId}-${p}`}
          aria-pressed={value === p}
          title={p}
          onClick={() => onChange(p)}
          style={{
            width: 16,
            height: 16,
            padding: 0,
            borderRadius: 3,
            border: "1px solid var(--default-border-color)",
            background:
              value === p ? "var(--color-primary)" : "var(--button-gray-1)",
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  </div>
);

/**
 * Tie the selected element to another element (a point of each, with a gap) or
 * to a ruler guide, so a layout holds together when things move.
 */
export const AnchorSection = ({ app }: { app: App }) => {
  const [from, setFrom] = useState<AnchorPoint>("tr");
  const [at, setAt] = useState<AnchorPoint>("tl");
  const [edge, setEdge] = useState<GuideEdge>("start");
  const [guideId, setGuideId] = useState<string>("");
  const selected = app.scene.getSelectedElements(app.state);
  const el = selected.length === 1 ? selected[0] : null;
  if (!el) {
    return null;
  }
  const anchor = getAnchor(el);
  const picking = app.state.anchorPick?.sourceId === el.id;
  const guides = app.state.guides;
  const guide = guides.find((g) => g.id === (guideId || guides[0]?.id));

  return (
    <Section
      title={t("labels.anchor.title")}
      hint={anchor ? "●" : undefined}
      testId="inspector-anchor"
    >
      {anchor && (
        <div
          className="inspector__hint"
          data-testid="anchor-summary"
          style={{ padding: "0 0 4px" }}
        >
          {isGuideAnchor(anchor)
            ? t("labels.anchor.followsGuide")
            : t("labels.anchor.followsElement")}
        </div>
      )}
      {anchor && !isGuideAnchor(anchor) && (
        <>
          <div className="inspector__row" style={{ marginTop: 0 }}>
            <span className="inspector__label">{t("labels.anchor.gapX")}</span>
            <NumberPill
              label={t("labels.anchor.gapX")}
              testId="anchor-dx"
              value={anchor.dx}
              min={-100000}
              max={100000}
              unit="px"
              onCommit={(v) => app.anchors.setGap(el.id, { dx: v })}
            />
          </div>
          <div className="inspector__row">
            <span className="inspector__label">{t("labels.anchor.gapY")}</span>
            <NumberPill
              label={t("labels.anchor.gapY")}
              testId="anchor-dy"
              value={anchor.dy}
              min={-100000}
              max={100000}
              unit="px"
              onCommit={(v) => app.anchors.setGap(el.id, { dy: v })}
            />
          </div>
        </>
      )}
      {anchor && isGuideAnchor(anchor) && (
        <div className="inspector__row" style={{ marginTop: 0 }}>
          <span className="inspector__label">{t("labels.anchor.offset")}</span>
          <NumberPill
            label={t("labels.anchor.offset")}
            testId="anchor-offset"
            value={anchor.offset}
            min={-100000}
            max={100000}
            unit="px"
            onCommit={(v) => app.anchors.setGap(el.id, { offset: v })}
          />
        </div>
      )}
      {anchor && (
        <div className="inspector__row">
          <button
            type="button"
            className="inspector__text"
            style={{ cursor: "pointer" }}
            data-testid="anchor-release"
            onClick={() => app.anchors.release(el.id)}
          >
            {t("labels.anchor.release")}
          </button>
        </div>
      )}

      <div className="inspector__row" style={{ alignItems: "flex-start" }}>
        <PointPicker
          label={t("labels.anchor.thisPoint")}
          value={at}
          onChange={setAt}
          testId="anchor-at"
        />
        <PointPicker
          label={t("labels.anchor.targetPoint")}
          value={from}
          onChange={setFrom}
          testId="anchor-from"
        />
      </div>
      <div className="inspector__row">
        <button
          type="button"
          className="inspector__text"
          style={{ cursor: "pointer" }}
          data-testid="anchor-pick"
          aria-pressed={picking}
          onClick={() =>
            picking
              ? app.anchors.cancelPick()
              : app.anchors.beginPick(el.id, from, at)
          }
        >
          {picking ? t("labels.anchor.picking") : t("labels.anchor.pick")}
        </button>
      </div>

      <div className="inspector__row">
        <span className="inspector__label">{t("labels.anchor.pin")}</span>
        {guides.length === 0 ? (
          <span className="inspector__hint" style={{ padding: 0 }}>
            {t("labels.anchor.noGuides")}
          </span>
        ) : (
          <>
            <select
              className="inspector__select"
              data-testid="anchor-guide"
              value={guide?.id ?? ""}
              onChange={(e) => setGuideId(e.target.value)}
            >
              {guides.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.axis === "x" ? "X" : "Y"}{" "}
                  {Math.round(g.position * 100) / 100}
                </option>
              ))}
            </select>
            <select
              className="inspector__select"
              data-testid="anchor-edge"
              value={edge}
              onChange={(e) => setEdge(e.target.value as GuideEdge)}
            >
              {(["start", "center", "end"] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`labels.anchor.edge_${k}` as any)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inspector__iconbtn"
              data-testid="anchor-pin"
              title={t("labels.anchor.pin")}
              onClick={() =>
                guide && app.anchors.setGuideAnchor(el.id, guide.id, edge)
              }
            >
              ⚓
            </button>
          </>
        )}
      </div>
    </Section>
  );
};

/** boolean operations on the selected closed shapes */
export const PathfinderSection = ({ app }: { app: App }) => {
  const selected = app.scene.getSelectedElements(app.state);
  const ready = selected.length >= 2 && selected.every(isPathfinderOperand);
  return (
    <Section title={t("labels.pathfinder.title")} testId="inspector-pathfinder">
      <div className="inspector__row" style={{ gap: 2 }}>
        {PATHFINDER_ACTIONS.map(([op, action]) => (
          <button
            key={op}
            type="button"
            className="inspector__iconbtn"
            style={{ width: "2rem", fontSize: "1rem" }}
            data-testid={`pathfinder-${op}`}
            title={t(`labels.pathfinder.${op}` as any)}
            disabled={!ready}
            onClick={() => app.actionManager.executeAction(action, "ui")}
          >
            <PathfinderIcon op={op} />
          </button>
        ))}
        <button
          type="button"
          className="inspector__iconbtn"
          style={{ width: "2rem", fontSize: "1rem" }}
          data-testid="pathfinder-compound"
          title={`${t("labels.pathfinder.compound")} (Ctrl+8)`}
          disabled={!ready}
          onClick={() =>
            app.actionManager.executeAction(actionMakeCompoundShape, "ui")
          }
        >
          <PathfinderIcon op="compound" />
        </button>
        <button
          type="button"
          className="inspector__iconbtn"
          style={{ width: "2rem", fontSize: "1rem" }}
          data-testid="pathfinder-release"
          title={`${t("labels.pathfinder.release")} (Ctrl+Alt+8)`}
          disabled={
            !selected.some((el) => el.type === "path" && el.contours?.length)
          }
          onClick={() =>
            app.actionManager.executeAction(actionReleaseCompoundShape, "ui")
          }
        >
          <PathfinderIcon op="release" />
        </button>
      </div>
    </Section>
  );
};

/**
 * The path tools as icons, where they are one click away (the toolbar keeps
 * them in its overflow menu): pen, knife, edit points, convert, join.
 */
export const PathSection = ({ app }: { app: App }) => {
  const selected = app.scene.getSelectedElements(app.state);
  const act = (action: any) => app.actionManager.executeAction(action, "ui");
  const canConvert = actionConvertShapeToPath.predicate?.(
    app.scene.getElementsIncludingDeleted(),
    app.state,
    app.props,
    app,
  );
  const canEdit =
    !app.state.editingPath &&
    selected.length === 1 &&
    selected[0].type === "path";
  const buttons: [
    string,
    React.ReactNode,
    string,
    boolean,
    boolean,
    () => void,
  ][] = [
    [
      "path-edit",
      "✎",
      t("labels.path.edit"),
      canEdit,
      !!app.state.editingPath,
      () => act(actionEditPath),
    ],
    [
      "path-convert",
      "⟲",
      t("labels.path.convertToPath"),
      !!canConvert,
      false,
      () => act(actionConvertShapeToPath),
    ],
    [
      "path-join",
      "⊕",
      t("labels.path.join"),
      selected.length === 2 && selected.every((el) => el.type === "path"),
      false,
      () => act(actionJoinPaths),
    ],
  ];
  return (
    <Section title={t("labels.path.title")} testId="inspector-path">
      <div className="inspector__row" style={{ gap: 2 }}>
        {buttons.map(([id, icon, title, enabled, active, run]) => (
          <button
            key={id}
            type="button"
            className="inspector__iconbtn"
            style={{ width: "2rem", height: "2rem" }}
            data-testid={id}
            title={title}
            aria-pressed={active}
            disabled={!enabled}
            onClick={run}
          >
            {icon}
          </button>
        ))}
      </div>
    </Section>
  );
};

/** edge sharpness of shapes and the bevel of path corners, all and local */
export const CornersSection = ({ app }: { app: App }) => {
  const selected = app.scene.getSelectedElements(app.state);
  const paths = selected.filter((el) => el.type === "path");
  const editing = app.state.editingPath;
  const rounded = selected.filter(
    (el) =>
      el.type === "rectangle" || el.type === "diamond" || el.type === "line",
  );
  const noSelection = selected.length === 0;
  if (!paths.length && !rounded.length && !editing && !noSelection) {
    return null;
  }
  // a plain rectangle or diamond: each corner can be rounded on its own, which
  // makes it a path (anchors = corners) with one bevel per anchor
  const single = selected.length === 1 ? selected[0] : null;
  const cornerShape =
    single &&
    (single.type === "rectangle" || single.type === "diamond") &&
    !(single.boundElements?.length ?? 0)
      ? single
      : null;
  const cornerLabels =
    cornerShape?.type === "diamond"
      ? ["T", "R", "B", "L"]
      : ["TL", "TR", "BR", "BL"];
  const bevelCorner = (index: number | null, radius: number) => {
    if (!cornerShape) {
      return;
    }
    const id = cornerShape.id;
    app.actionManager.executeAction(actionConvertShapeToPath, "ui");
    app.path.setBevelOf(id, index, radius);
  };
  const roundness = rounded.length
    ? rounded.every((el) => el.roundness)
      ? "round"
      : rounded.some((el) => el.roundness)
      ? null
      : "sharp"
    : app.state.currentItemRoundness;
  const setEdges = (value: "sharp" | "round") =>
    app.actionManager.executeAction(actionChangeRoundness, "ui", value);
  return (
    <Section title={t("labels.edges")} testId="inspector-corners">
      {(rounded.length > 0 || noSelection) && (
        <div className="inspector__row" style={{ gap: 2 }}>
          {(
            [
              ["sharp", EdgeSharpIcon, t("labels.sharp")],
              ["round", EdgeRoundIcon, t("labels.round")],
            ] as const
          ).map(([value, icon, title]) => (
            <button
              key={value}
              type="button"
              className="inspector__iconbtn"
              style={{ width: "2rem", height: "2rem" }}
              data-testid={`edges-${value}`}
              title={title}
              aria-pressed={roundness === value}
              onClick={() => setEdges(value)}
            >
              {icon}
            </button>
          ))}
        </div>
      )}
      {cornerShape && (
        <>
          <div className="inspector__row">
            <span className="inspector__label">
              {t("labels.path.bevelAll")}
            </span>
            <NumberPill
              label={t("labels.path.bevelAll")}
              testId="corner-all"
              value={0}
              min={0}
              max={1000}
              unit="px"
              onCommit={(v) => bevelCorner(null, v)}
            />
          </div>
          <div className="inspector__grid">
            {cornerLabels.map((label, i) => (
              <div className="inspector__row" key={label}>
                <span className="inspector__label" style={{ width: "1.5rem" }}>
                  {label}
                </span>
                <NumberPill
                  label={`${t("labels.path.bevelPoint")} ${label}`}
                  testId={`corner-${i}`}
                  value={0}
                  min={0}
                  max={1000}
                  unit="px"
                  onCommit={(v) => bevelCorner(i, v)}
                />
              </div>
            ))}
          </div>
        </>
      )}
      {single?.type === "path" && single.points.length <= 16 && (
        <div className="inspector__grid" data-testid="path-corners">
          {single.points.map((_, i) => (
            <div className="inspector__row" key={i}>
              <span className="inspector__label" style={{ width: "1.5rem" }}>
                {i + 1}
              </span>
              <NumberPill
                label={`${t("labels.path.bevelPoint")} ${i + 1}`}
                testId={`path-corner-${i}`}
                value={single.handles[i]?.radius ?? 0}
                min={0}
                max={1000}
                unit="px"
                onCommit={(v) => app.path.setBevelOf(single.id, i, v)}
              />
            </div>
          ))}
        </div>
      )}
      {(paths.length > 0 || editing) && (
        <>
          <div className="inspector__row">
            <span className="inspector__label">
              {t("labels.path.bevelAll")}
            </span>
            <NumberPill
              label={t("labels.path.bevelAll")}
              testId="path-bevel-all"
              value={app.path.getBevel("all")}
              min={0}
              max={1000}
              unit="px"
              onCommit={(v) => app.path.setBevel(v, "all")}
            />
          </div>
          {editing?.selectedPoint != null && (
            <div className="inspector__row">
              <span className="inspector__label">
                {t("labels.path.bevelPoint")}
              </span>
              <NumberPill
                label={t("labels.path.bevelPoint")}
                testId="path-bevel-point"
                value={app.path.getBevel("point")}
                min={0}
                max={1000}
                unit="px"
                onCommit={(v) => app.path.setBevel(v, "point")}
              />
            </div>
          )}
        </>
      )}
    </Section>
  );
};

type ToolEntry = {
  id: string;
  icon: React.ReactNode;
  title: string;
  shortcut?: string;
  /** a tool to activate, or something else to open */
  run: (app: App) => void;
  tool?: string;
};

const getToolEntries = (): ToolEntry[] => [
  {
    id: "image",
    icon: ImageIcon,
    title: t("toolBar.image"),
    shortcut: "9",
    tool: "image",
    run: (app) => app.setActiveTool({ type: "image" }),
  },
  {
    id: "frame",
    icon: frameToolIcon,
    title: t("toolBar.frame"),
    shortcut: "F",
    tool: "frame",
    run: (app) => app.setActiveTool({ type: "frame" }),
  },
  {
    id: "embeddable",
    icon: EmbedIcon,
    title: t("toolBar.embeddable"),
    tool: "embeddable",
    run: (app) => app.setActiveTool({ type: "embeddable" }),
  },
  {
    id: "autoshape",
    icon: drawShapeToolIcon,
    title: t("toolBar.autoshape"),
    shortcut: "Shift+X",
    tool: "autoshape",
    run: (app) => app.setActiveTool({ type: "autoshape" }),
  },
  {
    id: "laser",
    icon: laserPointerToolIcon,
    title: t("toolBar.laser"),
    shortcut: "K",
    tool: "laser",
    run: (app) => app.setActiveTool({ type: "laser" }),
  },
  {
    id: "bucketfill",
    icon: bucketFillIcon,
    title: t("toolBar.bucketfill"),
    shortcut: "B",
    tool: "bucketfill",
    run: (app) => app.setActiveTool({ type: "bucketfill" }),
  },
  {
    id: "path",
    icon: pathToolIcon,
    title: t("toolBar.path"),
    shortcut: "P",
    tool: "path",
    run: (app) => app.setActiveTool({ type: "path" }),
  },
  {
    id: "knife",
    icon: knifeToolIcon,
    title: t("toolBar.knife"),
    shortcut: "C",
    tool: "knife",
    run: (app) => app.setActiveTool({ type: "knife" }),
  },
  {
    id: "lasso",
    icon: LassoIcon,
    title: t("toolBar.lasso"),
    tool: "lasso",
    run: (app) => app.setActiveTool({ type: "lasso" }),
  },
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

/**
 * Every tool the toolbar keeps in its overflow menu, as icons that are one
 * click away, with Mermaid in and out. The gear chooses which ones show (kept
 * per browser).
 */
export const ToolsSection = ({ app }: { app: App }) => {
  const palette = useSyncExternalStore(subscribePalette, getPaletteState);
  const [customizing, setCustomizing] = useState(false);
  const active = app.state.activeTool.type;
  const hidden = new Set(palette.hiddenTools);
  const entries = getToolEntries().filter(
    (e) => customizing || !hidden.has(e.id),
  );
  return (
    <Section title={t("labels.tools.title")} testId="inspector-tools">
      <div className="inspector__row" style={{ gap: 2, flexWrap: "wrap" }}>
        {entries.map((e) => {
          const off = hidden.has(e.id);
          return (
            <button
              key={e.id}
              type="button"
              className="inspector__iconbtn"
              style={{
                width: "2rem",
                height: "2rem",
                opacity: customizing && off ? 0.35 : 1,
              }}
              data-testid={
                e.id === "path"
                  ? "path-tool-pen"
                  : e.id === "knife"
                  ? "path-tool-knife"
                  : `tool-${e.id}`
              }
              title={`${e.title}${e.shortcut ? ` (${e.shortcut})` : ""}${
                customizing ? ` — ${off ? "show" : "hide"}` : ""
              }`}
              aria-pressed={customizing ? !off : e.tool === active}
              disabled={
                !customizing && !!e.tool && isToolButtonDisabled(app, e.tool)
              }
              onClick={() =>
                customizing ? setToolHidden(e.id, !off) : e.run(app)
              }
            >
              {e.icon}
            </button>
          );
        })}
        <button
          type="button"
          className="inspector__iconbtn"
          style={{ width: "2rem", height: "2rem", marginLeft: "auto" }}
          data-testid="tools-customize"
          title={t("labels.tools.customize")}
          aria-pressed={customizing}
          onClick={() => setCustomizing(!customizing)}
        >
          ⚙
        </button>
      </div>
    </Section>
  );
};
