import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../../../i18n";
import Angle from "../../Stats/Angle";
import Dimension from "../../Stats/Dimension";
import MultiAngle from "../../Stats/MultiAngle";
import MultiDimension from "../../Stats/MultiDimension";
import MultiPosition from "../../Stats/MultiPosition";
import Position from "../../Stats/Position";
import { getAtomicUnits } from "../../Stats/utils";
import { Section } from "../primitives";

import type App from "../../App";

const TransformShell = ({ children }: { children: React.ReactNode }) => (
  <Section title={t("labels.palette.transform")} testId="inspector-transform">
    <div className="inspector__grid">{children}</div>
  </Section>
);

export const TransformSection = ({
  app,
  element,
}: {
  app: App;
  element: NonDeletedExcalidrawElement;
}) => {
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const common = { scene: app.scene, appState: app.state };
  return (
    <TransformShell>
      <Position
        property="x"
        element={element}
        elementsMap={elementsMap}
        {...common}
      />
      <Position
        property="y"
        element={element}
        elementsMap={elementsMap}
        {...common}
      />
      <Dimension property="width" element={element} {...common} />
      <Dimension property="height" element={element} {...common} />
      <Angle property="angle" element={element} {...common} />
    </TransformShell>
  );
};

/** Several shapes: the fields set every shape (mixed values read as "Mixed"). */
export const MultiTransformSection = ({
  app,
  elements,
}: {
  app: App;
  elements: readonly NonDeletedExcalidrawElement[];
}) => {
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const common = {
    elements,
    elementsMap,
    atomicUnits: getAtomicUnits(elements, app.state),
    scene: app.scene,
    appState: app.state,
  };
  return (
    <TransformShell>
      {(["x", "y"] as const).map((property) => (
        <MultiPosition key={property} property={property} {...common} />
      ))}
      {(["width", "height"] as const).map((property) => (
        <MultiDimension key={property} property={property} {...common} />
      ))}
      <MultiAngle
        property="angle"
        elements={elements}
        scene={app.scene}
        appState={app.state}
      />
    </TransformShell>
  );
};
