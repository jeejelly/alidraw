import { getBoundTextElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

const NODE_TYPES = new Set(["rectangle", "diamond", "ellipse"]);

const label = (text: string) =>
  text.trim().replace(/"/g, "#quot;").replace(/\n/g, "<br/>") || " ";

const textOf = (
  element: ExcalidrawElement,
  map: Map<string, ExcalidrawElement>,
): string => {
  const bound = getBoundTextElement(
    element,
    map as any,
  ) as ExcalidrawTextElement | null;
  return bound?.text ?? "";
};

/**
 * The diagram as a Mermaid flowchart: labelled rectangles, rounded boxes,
 * diamonds and ellipses are nodes; arrows and lines glued to two of them are
 * links (with the arrow's label, direction and dash style). The reverse of
 * pasting Mermaid in.
 */
export const elementsToMermaid = (
  elements: readonly ExcalidrawElement[],
): { text: string; nodes: number; links: number } => {
  const live = elements.filter((element) => !element.isDeleted);
  const map = new Map(live.map((element) => [element.id, element]));
  const nodes = live.filter((element) => NODE_TYPES.has(element.type));
  const ids = new Map(nodes.map((node, index) => [node.id, `n${index + 1}`]));

  const lines: string[] = [];
  for (const node of nodes) {
    const id = ids.get(node.id)!;
    const labelText = label(textOf(node, map));
    lines.push(
      node.type === "diamond"
        ? `  ${id}{"${labelText}"}`
        : node.type === "ellipse"
        ? `  ${id}(("${labelText}"))`
        : node.roundness
        ? `  ${id}("${labelText}")`
        : `  ${id}["${labelText}"]`,
    );
  }

  let links = 0;
  let dx = 0;
  let dy = 0;
  for (const element of live) {
    if (element.type !== "arrow" && element.type !== "line") {
      continue;
    }
    const startId =
      "startBinding" in element ? element.startBinding?.elementId : null;
    const endId =
      "endBinding" in element ? element.endBinding?.elementId : null;
    if (!startId || !endId || !ids.has(startId) || !ids.has(endId)) {
      continue;
    }
    const arrow = element.type === "arrow" ? element : null;
    const head = !!arrow?.endArrowhead;
    const tail = !!arrow?.startArrowhead;
    const dashed = element.strokeStyle !== "solid";
    const link = dashed
      ? `${tail ? "<" : ""}-.${head ? "->" : "-"}`
      : `${tail ? "<" : ""}--${head ? ">" : "-"}`;
    const text = textOf(element, map).trim();
    lines.push(
      `  ${ids.get(startId)} ${link}${
        text ? `|"${label(text)}"|` : ""
      } ${ids.get(endId)}`,
    );
    links++;
    const na = map.get(startId)!;
    const nb = map.get(endId)!;
    dx += Math.abs(nb.x + nb.width / 2 - (na.x + na.width / 2));
    dy += Math.abs(nb.y + nb.height / 2 - (na.y + na.height / 2));
  }
  if (!nodes.length) {
    return { text: "", nodes: 0, links: 0 };
  }
  return {
    text: `flowchart ${dx > dy ? "LR" : "TD"}\n${lines.join("\n")}\n`,
    nodes: nodes.length,
    links,
  };
};
