import {
  LinearElementEditor,
  bindBindingElementToFixedPoint,
  getBoundTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

import { getFlowMeta, withFlow, type FlowMeta } from "./flowMeta";
import { partsOf, shapeOf } from "./flowParts";
import { portsOf, portPoint, type FlowPort } from "./flowPorts";

type End = "start" | "end";
type LinkMeta = NonNullable<FlowMeta["link"]>;

/** a port edit: a name sets it, `null` clears it, `undefined` leaves it */
export type PortChange = { fromPort?: string | null; toPort?: string | null };

/** the ports a step has now: its own list, else the ones its shape and form bring */
export const stepPortsOf = (element: ExcalidrawElement): FlowPort[] => {
  const meta = getFlowMeta(element);
  return portsOf({
    shape: shapeOf(element),
    form: meta?.form,
    // an empty list means "none of its own", like readFlow
    ports: meta?.ports?.length ? meta.ports : undefined,
  });
};

const boxOf = (element: ExcalidrawElement) => ({
  x: element.x,
  y: element.y,
  w: element.width,
  h: element.height,
});

/** where a port sits on the canvas */
export const portScenePoint = (element: ExcalidrawElement, port: FlowPort) =>
  portPoint(boxOf(element), port);

/** the port of a step closest to `point`, if one lies within `reach` */
export const portNearPoint = (
  element: ExcalidrawElement,
  point: { x: number; y: number },
  reach: number,
): FlowPort | null => {
  let best: { port: FlowPort; gap: number } | null = null;
  for (const port of stepPortsOf(element)) {
    const [portX, portY] = portScenePoint(element, port);
    const gap = Math.hypot(point.x - portX, point.y - portY);
    if (gap <= reach && (!best || gap < best.gap)) {
      best = { port, gap };
    }
  }
  return best?.port ?? null;
};

/** writes the link part of an arrow's meta; `null` drops a field, an empty link is dropped whole */
export const updateLinkMeta = (
  scene: Scene,
  arrow: ExcalidrawArrowElement,
  patch: { [Field in keyof LinkMeta]?: LinkMeta[Field] | null },
) => {
  const meta = getFlowMeta(arrow);
  if (!meta) {
    return;
  }
  const link: Record<string, unknown> = { ...meta.link };
  for (const [field, value] of Object.entries(patch)) {
    if (value === null || value === undefined) {
      delete link[field];
    } else {
      link[field] = value;
    }
  }
  const { link: _previous, ...rest } = meta;
  scene.mutateElement(arrow, {
    customData: withFlow(arrow, {
      ...rest,
      ...(Object.keys(link).length ? { link: link as LinkMeta } : {}),
    }),
  });
};

/** glues one end of a link to a port: the binding's fixed point and the end itself */
const snapEnd = (
  scene: Scene,
  arrow: ExcalidrawArrowElement,
  end: End,
  step: ExcalidrawElement,
  port: FlowPort,
) => {
  const [portX, portY] = portScenePoint(step, port);
  bindBindingElementToFixedPoint(
    arrow as NonDeleted<ExcalidrawArrowElement>,
    step as any,
    end,
    [port.at[0], port.at[1]],
    scene,
  );
  const index = end === "start" ? 0 : arrow.points.length - 1;
  LinearElementEditor.movePoints(
    arrow as NonDeleted<ExcalidrawArrowElement>,
    scene,
    new Map([
      [index, { point: [portX - arrow.x, portY - arrow.y] as LocalPoint }],
    ]),
  );
};

/** the label follows when the arrow's ends moved */
const keepLabel = (scene: Scene, arrow: ExcalidrawArrowElement) => {
  const label = getBoundTextElement(arrow, scene.getNonDeletedElementsMap());
  if (label) {
    redrawTextBoundingBox(label, arrow, scene);
  }
};

/** the arrow's ends moved onto the ports its meta names; ends without a (known) port stay as they are */
export const routeLinkToPorts = (
  scene: Scene,
  arrow: ExcalidrawArrowElement,
) => {
  const meta = getFlowMeta(arrow);
  const elements = scene.getNonDeletedElementsMap();
  if (!meta?.link) {
    return;
  }
  const ends: [End, string | undefined][] = [
    ["start", meta.link.fromPort],
    ["end", meta.link.toPort],
  ];
  let moved = false;
  for (const [end, name] of ends) {
    const binding = end === "start" ? arrow.startBinding : arrow.endBinding;
    const step = binding && elements.get(binding.elementId);
    const port = step && stepPortsOf(step).find((entry) => entry.name === name);
    if (step && port) {
      snapEnd(scene, arrow, end, step, port);
      moved = true;
    }
  }
  if (moved) {
    keepLabel(scene, arrow);
  }
};

/** names ports on a link and moves its ends there (`null` clears a port) */
export const setLinkPorts = (
  scene: Scene,
  arrow: ExcalidrawArrowElement,
  change: PortChange,
) => {
  updateLinkMeta(scene, arrow, change);
  routeLinkToPorts(scene, arrow);
};

/** the links of a flow glued to a step, with the end that touches it */
const linksOf = (scene: Scene, flowId: string, key: string) => {
  const parts = partsOf(scene.getElementsIncludingDeleted(), flowId);
  const touching: { arrow: ExcalidrawArrowElement; ends: End[] }[] = [];
  for (const arrow of parts.arrows) {
    const ends: End[] = [];
    if (parts.keyOfId.get(arrow.startBinding!.elementId) === key) {
      ends.push("start");
    }
    if (parts.keyOfId.get(arrow.endBinding!.elementId) === key) {
      ends.push("end");
    }
    if (ends.length && getFlowMeta(arrow)?.link) {
      touching.push({ arrow, ends });
    }
  }
  return touching;
};

/**
 * Gives a step its own ports (`null`: the ones its shape brings) and brings
 * the links on it along: a renamed port keeps its links, a removed one frees
 * them (they stay glued, only without a port), the rest move to their ports.
 */
export const setStepPorts = (
  scene: Scene,
  flowId: string,
  key: string,
  ports: readonly FlowPort[] | null,
  renames: ReadonlyMap<string, string> = new Map(),
) => {
  const step = partsOf(scene.getElementsIncludingDeleted(), flowId).byKey.get(
    key,
  );
  const meta = step && getFlowMeta(step);
  if (!step || !meta) {
    return false;
  }
  const { ports: _previous, ...rest } = meta;
  scene.mutateElement(step, {
    customData: withFlow(step, {
      ...rest,
      ...(ports?.length
        ? { ports: ports.map((port) => ({ name: port.name, at: port.at })) }
        : {}),
    }),
  });
  const known = new Set(stepPortsOf(step).map((port) => port.name));
  const settle = (name?: string) => {
    const next = name && (renames.get(name) ?? name);
    return next && known.has(next) ? next : null;
  };
  for (const { arrow, ends } of linksOf(scene, flowId, key)) {
    const link = getFlowMeta(arrow)!.link!;
    updateLinkMeta(scene, arrow, {
      ...(ends.includes("start") ? { fromPort: settle(link.fromPort) } : {}),
      ...(ends.includes("end") ? { toPort: settle(link.toPort) } : {}),
    });
    routeLinkToPorts(scene, arrow);
  }
  return true;
};

/**
 * A link end dropped at `point`: on a port of the step it is glued to, the
 * link takes that port; elsewhere on the step it loses its port. The
 * binding is never touched here.
 */
export const settleLinkEnd = (
  scene: Scene,
  arrow: ExcalidrawArrowElement,
  end: End,
  point: { x: number; y: number },
  reach: number,
) => {
  const meta = getFlowMeta(arrow);
  const binding = end === "start" ? arrow.startBinding : arrow.endBinding;
  const step =
    binding && scene.getNonDeletedElementsMap().get(binding.elementId);
  if (!meta || meta.kind !== "edge" || !step) {
    return false;
  }
  const parts = partsOf(scene.getElementsIncludingDeleted(), meta.id);
  const from = parts.keyOfId.get(arrow.startBinding?.elementId ?? "");
  const to = parts.keyOfId.get(arrow.endBinding?.elementId ?? "");
  if (!parts.keyOfId.has(step.id) || !from || !to) {
    return false;
  }
  const port = portNearPoint(step, point, reach);
  // the steps may have changed with the drop: the key follows
  scene.mutateElement(arrow, {
    customData: withFlow(arrow, { ...meta, key: `${from}>${to}` }),
  });
  setLinkPorts(
    scene,
    arrow,
    end === "start"
      ? { fromPort: port?.name ?? null }
      : { toPort: port?.name ?? null },
  );
  return true;
};
