import { useState } from "react";

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
} from "../../actions";
import { t } from "../../i18n";

import { NumberPill, Section } from "./primitives";

import type App from "./../App";

// built on use: the actions module is still loading when this file is first read
const getAligners = () =>
  [
    ["⇤", actionAlignLeft, "labels.alignLeft"],
    ["⇹", actionAlignHorizontallyCentered, "labels.centerHorizontally"],
    ["⇥", actionAlignRight, "labels.alignRight"],
    ["⤒", actionAlignTop, "labels.alignTop"],
    ["⇳", actionAlignVerticallyCentered, "labels.centerVertically"],
    ["⤓", actionAlignBottom, "labels.alignBottom"],
    ["↔", distributeHorizontally, "labels.distributeHorizontally"],
    ["↕", distributeVertically, "labels.distributeVertically"],
  ] as const;

/** Illustrator's Align panel: six alignments and two distributions */
export const AlignSection = ({ app }: { app: App }) => {
  const count = app.scene.getSelectedElements(app.state).length;
  return (
    <Section title={t("labels.alignPanel.title")} testId="inspector-align">
      <div className="inspector__row" style={{ gap: 2, flexWrap: "wrap" }}>
        {getAligners().map(([glyph, action, label]) => (
          <button
            key={label}
            type="button"
            className="inspector__iconbtn"
            data-testid={`align-${label.split(".")[1]}`}
            title={t(label)}
            disabled={count < (glyph === "↔" || glyph === "↕" ? 3 : 2)}
            onClick={() => app.actionManager.executeAction(action, "ui")}
          >
            {glyph}
          </button>
        ))}
      </div>
    </Section>
  );
};

/** grid on/off, spacing, subdivisions, and fitting the selection to it */
export const GridSection = ({ app }: { app: App }) => {
  const { gridModeEnabled, gridSize, gridStep } = app.state;
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
