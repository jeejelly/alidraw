import { useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  getAnchor,
  isGuideAnchor,
  ANCHOR_POINTS,
  type AnchorPoint,
  type GuideEdge,
} from "../../../anchors";
import { t } from "../../../i18n";
import { NumberPill, Section } from "../primitives";

import type App from "../../App";

type Anchor = NonNullable<ReturnType<typeof getAnchor>>;
type Guide = App["state"]["guides"][number];

const GAP_LIMIT = 100000;
const GUIDE_EDGES = ["start", "center", "end"] as const;

const PointPicker = ({
  value,
  onChange,
  label,
  testId,
}: {
  value: AnchorPoint;
  onChange: (point: AnchorPoint) => void;
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
      {ANCHOR_POINTS.map((point) => (
        <button
          key={point}
          type="button"
          data-testid={`${testId}-${point}`}
          aria-pressed={value === point}
          title={point}
          onClick={() => onChange(point)}
          style={{
            width: 16,
            height: 16,
            padding: 0,
            borderRadius: 3,
            border: "1px solid var(--default-border-color)",
            background:
              value === point ? "var(--color-primary)" : "var(--button-gray-1)",
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  </div>
);

const GapRow = ({
  label,
  testId,
  value,
  first,
  onCommit,
}: {
  label: string;
  testId: string;
  value: number;
  first?: boolean;
  onCommit: (value: number) => void;
}) => (
  <div className="inspector__row" style={first ? { marginTop: 0 } : undefined}>
    <span className="inspector__label">{label}</span>
    <NumberPill
      label={label}
      testId={testId}
      value={value}
      min={-GAP_LIMIT}
      max={GAP_LIMIT}
      unit="px"
      onCommit={onCommit}
    />
  </div>
);

/** Gap (or guide offset) of the current anchor, plus the release button. */
const CurrentAnchor = ({
  app,
  element,
  anchor,
}: {
  app: App;
  element: ExcalidrawElement;
  anchor: Anchor;
}) => (
  <>
    <div
      className="inspector__hint"
      data-testid="anchor-summary"
      style={{ padding: "0 0 4px" }}
    >
      {isGuideAnchor(anchor)
        ? t("labels.anchor.followsGuide")
        : t("labels.anchor.followsElement")}
    </div>
    {isGuideAnchor(anchor) ? (
      <GapRow
        first
        label={t("labels.anchor.offset")}
        testId="anchor-offset"
        value={anchor.offset}
        onCommit={(value) => app.anchors.setGap(element.id, { offset: value })}
      />
    ) : (
      <>
        <GapRow
          first
          label={t("labels.anchor.gapX")}
          testId="anchor-dx"
          value={anchor.dx}
          onCommit={(value) => app.anchors.setGap(element.id, { dx: value })}
        />
        <GapRow
          label={t("labels.anchor.gapY")}
          testId="anchor-dy"
          value={anchor.dy}
          onCommit={(value) => app.anchors.setGap(element.id, { dy: value })}
        />
      </>
    )}
    <div className="inspector__row">
      <button
        type="button"
        className="inspector__text"
        style={{ cursor: "pointer" }}
        data-testid="anchor-release"
        onClick={() => app.anchors.release(element.id)}
      >
        {t("labels.anchor.release")}
      </button>
    </div>
  </>
);

/** Pin the element to a ruler guide, choosing which guide and which edge. */
const GuidePinRow = ({
  app,
  element,
  guides,
}: {
  app: App;
  element: ExcalidrawElement;
  guides: readonly Guide[];
}) => {
  const [edge, setEdge] = useState<GuideEdge>("start");
  const [guideId, setGuideId] = useState<string>("");
  const guide = guides.find((entry) => entry.id === (guideId || guides[0]?.id));
  return (
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
            onChange={(event) => setGuideId(event.target.value)}
          >
            {guides.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.axis === "x" ? "X" : "Y"}{" "}
                {Math.round(entry.position * 100) / 100}
              </option>
            ))}
          </select>
          <select
            className="inspector__select"
            data-testid="anchor-edge"
            value={edge}
            onChange={(event) => setEdge(event.target.value as GuideEdge)}
          >
            {GUIDE_EDGES.map((option) => (
              <option key={option} value={option}>
                {t(`labels.anchor.edge_${option}` as any)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inspector__iconbtn"
            data-testid="anchor-pin"
            title={t("labels.anchor.pin")}
            onClick={() =>
              guide && app.anchors.setGuideAnchor(element.id, guide.id, edge)
            }
          >
            ⚓
          </button>
        </>
      )}
    </div>
  );
};

/**
 * Tie the selected element to another element (a point of each, with a gap) or
 * to a ruler guide, so a layout holds together when things move.
 */
export const AnchorSection = ({ app }: { app: App }) => {
  const [from, setFrom] = useState<AnchorPoint>("tr");
  const [at, setAt] = useState<AnchorPoint>("tl");
  const selected = app.scene.getSelectedElements(app.state);
  const element = selected.length === 1 ? selected[0] : null;
  if (!element) {
    return null;
  }
  const anchor = getAnchor(element);
  const picking = app.state.anchorPick?.sourceId === element.id;

  return (
    <Section
      title={t("labels.anchor.title")}
      hint={anchor ? "●" : undefined}
      testId="inspector-anchor"
    >
      {anchor && <CurrentAnchor app={app} element={element} anchor={anchor} />}

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
              : app.anchors.beginPick(element.id, from, at)
          }
        >
          {picking ? t("labels.anchor.picking") : t("labels.anchor.pick")}
        </button>
      </div>

      <GuidePinRow app={app} element={element} guides={app.state.guides} />
    </Section>
  );
};
