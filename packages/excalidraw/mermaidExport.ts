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
  const live = elements.filter((e) => !e.isDeleted);
  const map = new Map(live.map((e) => [e.id, e]));
  const nodes = live.filter((e) => NODE_TYPES.has(e.type));
  const ids = new Map(nodes.map((n, i) => [n.id, `n${i + 1}`]));

  const lines: string[] = [];
  for (const n of nodes) {
    const id = ids.get(n.id)!;
    const t = label(textOf(n, map));
    lines.push(
      n.type === "diamond"
        ? `  ${id}{"${t}"}`
        : n.type === "ellipse"
        ? `  ${id}(("${t}"))`
        : n.roundness
        ? `  ${id}("${t}")`
        : `  ${id}["${t}"]`,
    );
  }

  let links = 0;
  let dx = 0;
  let dy = 0;
  for (const e of live) {
    if (e.type !== "arrow" && e.type !== "line") {
      continue;
    }
    const a = "startBinding" in e ? e.startBinding?.elementId : null;
    const b = "endBinding" in e ? e.endBinding?.elementId : null;
    if (!a || !b || !ids.has(a) || !ids.has(b)) {
      continue;
    }
    const arrow = e.type === "arrow" ? e : null;
    const head = !!arrow?.endArrowhead;
    const tail = !!arrow?.startArrowhead;
    const dashed = e.strokeStyle !== "solid";
    const link = dashed
      ? `${tail ? "<" : ""}-.${head ? "->" : "-"}`
      : `${tail ? "<" : ""}--${head ? ">" : "-"}`;
    const text = textOf(e, map).trim();
    lines.push(
      `  ${ids.get(a)} ${link}${text ? `|"${label(text)}"|` : ""} ${ids.get(
        b,
      )}`,
    );
    links++;
    const na = map.get(a)!;
    const nb = map.get(b)!;
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
