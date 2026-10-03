import {
  flowSelectionOf,
  partsOf,
  portScenePoint,
  stepPortsOf,
} from "@excalidraw/flow";

import type { Point } from "./resolveTarget";
import type App from "../App";

export type PortDot = {
  flowId: string;
  key: string;
  name: string;
  /** scene coordinates */
  center: Point;
  /** share of the step's width and height: tells which side the name goes */
  at: [number, number];
};

export type PortStep = { flowId: string; key: string };

/** the dots of one step: one per port */
export const dotsOfStep = (app: App, { flowId, key }: PortStep): PortDot[] => {
  const step = partsOf(
    app.scene.getElementsIncludingDeleted(),
    flowId,
  ).byKey.get(key);
  if (!step) {
    return [];
  }
  return stepPortsOf(step).map((port) => {
    const [x, y] = portScenePoint(step, port);
    return { flowId, key, name: port.name, center: { x, y }, at: port.at };
  });
};

/** the step whose ports show: the selected one (when it is alone) */
export const selectedPortStep = (app: App): PortStep | null => {
  if (app.state.viewModeEnabled) {
    return null;
  }
  const selection = flowSelectionOf(
    app.scene.getElementsIncludingDeleted(),
    app.scene.getSelectedElements(app.state),
  );
  return selection?.kind === "step"
    ? { flowId: selection.flowId, key: selection.key }
    : null;
};

/** the dots on show for the selection */
export const selectedPortDots = (app: App) => {
  const step = selectedPortStep(app);
  return step ? dotsOfStep(app, step) : [];
};
