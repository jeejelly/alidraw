import { getCornerRadius } from "@excalidraw/element";
import { ROUNDNESS } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

import {
  actionChangeRoundness,
  actionConvertShapeToPath,
} from "../../../actions";
import { t } from "../../../i18n";
import { EdgeRoundIcon, EdgeSharpIcon } from "../../icons";
import { PathActionIcon } from "../PathfinderIcons";
import { NumberPill, Section, SliderRow } from "../primitives";

import type App from "../../App";

const BEVEL_LIMIT = 1000;
// beyond this the per-point list gets too long to be useful
const MAX_LISTED_POINTS = 16;

const isRadiusTarget = (element: ExcalidrawElement) =>
  element.type === "rectangle" || element.type === "diamond";

const EdgeButtons = ({
  app,
  rounded,
  showToggle,
}: {
  app: App;
  rounded: readonly ExcalidrawElement[];
  showToggle: boolean;
}) => {
  const roundness = rounded.length
    ? rounded.every((element) => element.roundness)
      ? "round"
      : rounded.some((element) => element.roundness)
      ? null
      : "sharp"
    : app.state.currentItemRoundness;
  const showEdges =
    rounded.length > 0 || app.scene.getSelectedElements(app.state).length === 0;
  return (
    <div className="inspector__row" style={{ gap: 2 }}>
      {showEdges &&
        (
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
            onClick={() =>
              app.actionManager.executeAction(
                actionChangeRoundness,
                "ui",
                value,
              )
            }
          >
            {icon}
          </button>
        ))}
      {showToggle && (
        <button
          type="button"
          className="inspector__iconbtn"
          style={{ width: "2rem", height: "2rem" }}
          data-testid="corner-mode"
          title={t("labels.corners.toggle")}
          aria-pressed={app.state.cornerMode}
          onClick={() => app.corners.toggle()}
        >
          <PathActionIcon kind="corner" />
        </button>
      )}
    </div>
  );
};

/** One parametric radius for every corner of the selected rectangles/diamonds. */
const RadiusSlider = ({
  app,
  targets,
}: {
  app: App;
  targets: readonly ExcalidrawElement[];
}) => {
  const radiusOf = (element: ExcalidrawElement) =>
    Math.round(
      getCornerRadius(Math.min(element.width, element.height), element),
    );
  const radii = new Set(targets.map(radiusOf));
  const sharedRadius = radii.size === 1 ? [...radii][0] : null;
  const maxRadius = Math.max(
    4,
    Math.round(
      Math.min(
        ...targets.map((element) => Math.min(element.width, element.height)),
      ) / 2,
    ),
  );
  const setRadius = (value: number) => {
    for (const element of targets) {
      app.scene.mutateElement(element, {
        roundness:
          value > 0 ? { type: ROUNDNESS.ADAPTIVE_RADIUS, value } : null,
      });
    }
    app.store.scheduleCapture();
    app.setState({});
  };
  return (
    <SliderRow
      label={t("labels.path.bevelAll")}
      testId="corner-radius"
      value={sharedRadius}
      min={0}
      max={maxRadius}
      unit="px"
      onChange={setRadius}
    />
  );
};

/**
 * Each corner of a plain rectangle or diamond can be rounded on its own, which
 * turns it into a path (anchors = corners) with one bevel per anchor.
 */
const ShapeCornerBevels = ({
  app,
  shape,
}: {
  app: App;
  shape: ExcalidrawElement;
}) => {
  const labels =
    shape.type === "diamond" ? ["T", "R", "B", "L"] : ["TL", "TR", "BR", "BL"];
  const bevelCorner = (index: number, radius: number) => {
    const id = shape.id;
    app.actionManager.executeAction(actionConvertShapeToPath, "ui");
    app.path.setBevelOf(id, index, radius);
  };
  return (
    <div className="inspector__grid">
      {labels.map((label, index) => (
        <div className="inspector__row" key={label}>
          <span className="inspector__label" style={{ width: "1.5rem" }}>
            {label}
          </span>
          <NumberPill
            label={`${t("labels.path.bevelPoint")} ${label}`}
            testId={`corner-${index}`}
            value={0}
            min={0}
            max={BEVEL_LIMIT}
            unit="px"
            onCommit={(value) => bevelCorner(index, value)}
          />
        </div>
      ))}
    </div>
  );
};

const PathPointBevels = ({
  app,
  path,
}: {
  app: App;
  path: ExcalidrawPathElement;
}) => (
  <div className="inspector__grid" data-testid="path-corners">
    {path.points.map((_, index) => (
      <div className="inspector__row" key={index}>
        <span className="inspector__label" style={{ width: "1.5rem" }}>
          {index + 1}
        </span>
        <NumberPill
          label={`${t("labels.path.bevelPoint")} ${index + 1}`}
          testId={`path-corner-${index}`}
          value={path.handles[index]?.radius ?? 0}
          min={0}
          max={BEVEL_LIMIT}
          unit="px"
          onCommit={(value) => app.path.setBevelOf(path.id, index, value)}
        />
      </div>
    ))}
  </div>
);

const PathBevelControls = ({ app }: { app: App }) => (
  <>
    <SliderRow
      label={t("labels.path.bevelAll")}
      testId="path-bevel-all"
      value={app.path.getBevel("all")}
      min={0}
      max={200}
      unit="px"
      onChange={(value) => app.path.setBevel(value, "all")}
    />
    {app.state.editingPath?.selectedPoint != null && (
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.path.bevelPoint")}</span>
        <NumberPill
          label={t("labels.path.bevelPoint")}
          testId="path-bevel-point"
          value={app.path.getBevel("point")}
          min={0}
          max={BEVEL_LIMIT}
          unit="px"
          onCommit={(value) => app.path.setBevel(value, "point")}
        />
      </div>
    )}
  </>
);

/** Edge sharpness of shapes and the bevel of path corners, all and local. */
export const CornersSection = ({ app }: { app: App }) => {
  const selected = app.scene.getSelectedElements(app.state);
  const paths = selected.filter((element) => element.type === "path");
  const editing = app.state.editingPath;
  const rounded = selected.filter(
    (element) =>
      element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "line",
  );
  if (!paths.length && !rounded.length && !editing && selected.length > 0) {
    return null;
  }
  const single = selected.length === 1 ? selected[0] : null;
  const cornerShape =
    single && isRadiusTarget(single) && !(single.boundElements?.length ?? 0)
      ? single
      : null;
  const radiusTargets = selected.filter(isRadiusTarget);

  return (
    <Section title={t("labels.edges")} testId="inspector-corners">
      <EdgeButtons
        app={app}
        rounded={rounded}
        showToggle={radiusTargets.length > 0 || single?.type === "path"}
      />
      {app.state.cornerMode && (
        <span className="inspector__hint" style={{ padding: 0 }}>
          {t("labels.corners.hint")}
        </span>
      )}
      {radiusTargets.length > 0 && (
        <RadiusSlider app={app} targets={radiusTargets} />
      )}
      {cornerShape && <ShapeCornerBevels app={app} shape={cornerShape} />}
      {single?.type === "path" && single.points.length <= MAX_LISTED_POINTS && (
        <PathPointBevels app={app} path={single} />
      )}
      {(paths.length > 0 || editing) && <PathBevelControls app={app} />}
    </Section>
  );
};
