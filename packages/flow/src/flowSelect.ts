import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
} from "@excalidraw/element/types";

import { getFlowMeta, isNodeType } from "./flowMeta";
import { partsOf } from "./flowParts";

/** what a selection is, as far as the flow is concerned */
export type FlowSelection =
  | { kind: "step"; flowId: string; key: string; element: ExcalidrawElement }
  | {
      /** `tagged`: the arrow carries flow meta; otherwise it is only drawn between two steps */
      kind: "link";
      tagged: boolean;
      flowId: string;
      from: string;
      to: string;
      arrow: ExcalidrawArrowElement;
    }
  | null;

const linkOf = (
  all: readonly ExcalidrawElement[],
  arrow: ExcalidrawArrowElement,
): FlowSelection => {
  const byId = new Map(all.map((element) => [element.id, element]));
  const start = byId.get(arrow.startBinding?.elementId ?? "");
  const flowId = start && getFlowMeta(start)?.id;
  if (!flowId) {
    return null;
  }
  const { keyOfId } = partsOf(all, flowId);
  const from = keyOfId.get(arrow.startBinding!.elementId);
  const to = keyOfId.get(arrow.endBinding?.elementId ?? "");
  return from && to
    ? {
        kind: "link",
        tagged: getFlowMeta(arrow)?.kind === "edge",
        flowId,
        from,
        to,
        arrow,
      }
    : null;
};

/** one step, or one link between two steps, or nothing in particular */
export const flowSelectionOf = (
  all: readonly ExcalidrawElement[],
  selected: readonly ExcalidrawElement[],
): FlowSelection => {
  if (selected.length === 1 && selected[0].type === "arrow") {
    return linkOf(all, selected[0] as ExcalidrawArrowElement);
  }
  const steps = new Map<string, FlowSelection & { kind: "step" }>();
  for (const element of selected) {
    const meta = getFlowMeta(element);
    if (meta?.kind === "node" && isNodeType(element.type)) {
      steps.set(`${meta.id}/${meta.key}`, {
        kind: "step",
        flowId: meta.id,
        key: meta.key,
        element,
      });
    }
  }
  return steps.size === 1 ? [...steps.values()][0] : null;
};
