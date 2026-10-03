import type { FlowForm } from "./flowForms";
import type { FlowShape } from "./flowGraph";

/** A named place on a step's border where links attach: `at` is a share of its width and height. */
export type FlowPort = { name: string; at: [number, number] };

const DECISION: FlowPort[] = [
  { name: "in", at: [0.5, 0] },
  { name: "yes", at: [0.5, 1] },
  { name: "no", at: [1, 0.5] },
  { name: "other", at: [0, 0.5] },
];

const FORK: FlowPort[] = [
  { name: "in", at: [0.5, 0] },
  { name: "first", at: [0.2, 1] },
  { name: "second", at: [0.5, 1] },
  { name: "third", at: [0.8, 1] },
];

/** ready-made sets a step can be given */
export const PORT_PRESETS = { decision: DECISION, fork: FORK };

const LOOP: FlowPort[] = [
  { name: "in", at: [0.5, 0] },
  { name: "body", at: [0.5, 1] },
  { name: "exit", at: [1, 0.5] },
  { name: "back", at: [0, 0.5] },
];

/** forms that come with ports of their own */
const FORM_PORTS: Partial<Record<FlowForm, FlowPort[]>> = {
  fork: FORK,
  hexagon: LOOP,
  "loop-limit": LOOP,
};

/** the ports a step has unless it lists its own: a diamond is a decision with outcomes */
export const defaultPortsOf = (shape: FlowShape, form?: FlowForm) =>
  (form && FORM_PORTS[form]) || (shape === "diamond" ? DECISION : []);

export const portsOf = (step: {
  shape: FlowShape;
  form?: FlowForm;
  ports?: FlowPort[];
}) => step.ports ?? defaultPortsOf(step.shape, step.form);

export const portPoint = (
  box: { x: number; y: number; w: number; h: number },
  port: FlowPort,
): [number, number] => [box.x + box.w * port.at[0], box.y + box.h * port.at[1]];

const NEAR = 0.08;

/** the port a binding point sits on (a link dropped on a port), if any */
export const portAt = (
  ports: readonly FlowPort[],
  point: readonly [number, number] | undefined,
) =>
  point
    ? ports.find(
        (port) =>
          Math.abs(port.at[0] - point[0]) < NEAR &&
          Math.abs(port.at[1] - point[1]) < NEAR,
      )
    : undefined;

/** an outcome written as the label of a link out of a decision: `-- yes -->` */
export const portOfLabel = (ports: readonly FlowPort[], label: string) =>
  label
    ? ports.find(
        (port) => port.name.toLowerCase() === label.trim().toLowerCase(),
      )
    : undefined;
