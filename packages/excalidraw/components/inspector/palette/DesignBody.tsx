import { useSyncExternalStore } from "react";

import { getBoundTextElement, isTextElement } from "@excalidraw/element";
import {
  getPaletteState,
  normalizeHex,
  subscribePalette,
} from "@excalidraw/color";

import {
  actionChangeBackgroundColor,
  actionChangeStrokeColor,
} from "../../../actions";
import { getTargetElements } from "../../../scene";
import { getShapeActionPredicates } from "../../shapeActionPredicates";
import {
  AlignSection,
  AnchorSection,
  CornersSection,
  GridSection,
  ImageStorageSection,
  PathSection,
  PathfinderSection,
  VectorizeSection,
} from "../LayoutSections";
import { SymbolLayoutSection } from "../SymbolsPanel";

import { AppearanceSection } from "./AppearanceSection";
import { OptionsSection } from "./OptionsSection";
import { StrokeSection } from "./StrokeSection";
import { SwatchesSection } from "./SwatchesSection";
import { MultiTransformSection, TransformSection } from "./TransformSection";
import { TypeSection } from "./TypeSection";

import type { ColorTarget, RunAction } from "./types";

import type App from "../../App";

/** The Design tab: every section that edits the selection or the defaults. */
export const DesignBody = ({
  app,
  target,
  onTargetChange,
  run,
}: {
  app: App;
  target: ColorTarget;
  onTargetChange: (target: ColorTarget) => void;
  run: RunAction;
}) => {
  const palette = useSyncExternalStore(subscribePalette, getPaletteState);
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const selected = app.scene.getSelectedElements(app.state);
  const first = selected[0];
  const strokeColor = first?.strokeColor ?? app.state.currentItemStrokeColor;
  const backgroundColor =
    first?.backgroundColor ?? app.state.currentItemBackgroundColor;
  const currentColor = target === "stroke" ? strokeColor : backgroundColor;
  // a shape's own label counts: its type controls belong to the shape
  const textElement =
    selected.find(isTextElement) ??
    selected
      .map((element) => getBoundTextElement(element, elementsMap))
      .find(Boolean) ??
    null;

  const applyColor = (color: string, which: ColorTarget = target) =>
    run(
      which === "stroke"
        ? actionChangeStrokeColor
        : actionChangeBackgroundColor,
      { color },
    );

  const predicates = getShapeActionPredicates(
    app.state,
    getTargetElements(elementsMap, app.state),
    elementsMap,
    app,
  );

  return (
    <>
      {selected.length === 1 && <TransformSection app={app} element={first} />}
      {selected.length > 1 && (
        <MultiTransformSection app={app} elements={selected} />
      )}
      <SymbolLayoutSection app={app} />
      <ImageStorageSection app={app} />
      <VectorizeSection app={app} />
      <PathSection app={app} />
      <AlignSection app={app} />
      <PathfinderSection app={app} />
      <AppearanceSection
        target={target}
        onTargetChange={onTargetChange}
        strokeColor={strokeColor}
        backgroundColor={backgroundColor}
        opacity={first?.opacity ?? app.state.currentItemOpacity}
        hasSelection={selected.length > 0}
        applyColor={applyColor}
        run={run}
      />
      <CornersSection app={app} />
      <SwatchesSection
        app={app}
        swatches={palette.swatches}
        hex={normalizeHex(currentColor)}
        applyColor={applyColor}
      />
      <StrokeSection app={app} run={run} />
      {(textElement || app.state.activeTool.type === "text") && (
        <TypeSection
          app={app}
          textElement={textElement}
          predicates={predicates}
          run={run}
        />
      )}
      {(predicates.hasSelection ||
        app.state.activeTool.type !== "selection") && (
        <OptionsSection app={app} predicates={predicates} />
      )}
      <GridSection app={app} />
      <AnchorSection app={app} />
    </>
  );
};
