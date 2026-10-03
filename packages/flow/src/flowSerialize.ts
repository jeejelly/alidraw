import type {
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowScreen,
  FlowShape,
} from "./flowGraph";

const quote = (label: string) =>
  `"${label.replace(/"/g, "#quot;").replace(/\r?\n/g, "<br/>") || " "}"`;

const SHAPE_OPEN: Record<FlowShape, [string, string]> = {
  rect: ["[", "]"],
  round: ["(", ")"],
  diamond: ["{", "}"],
  ellipse: ["((", "))"],
};

const linkText = (edge: FlowEdge) => {
  const left = edge.tail ? "<" : "";
  const arrow =
    edge.style === "dashed"
      ? edge.head
        ? "-.->"
        : "-.-"
      : edge.style === "thick"
      ? edge.head
        ? "==>"
        : "==="
      : edge.head
      ? "-->"
      : "---";
  return `${left}${arrow}${edge.label ? `|${quote(edge.label)}|` : ""}`;
};

export const serializeFlow = (graph: FlowGraph): string => {
  const out = [`flowchart ${graph.direction}`];
  const nodeLine = (node: FlowNode) => {
    const [openToken, closeToken] = SHAPE_OPEN[node.shape];
    return `${node.key}${openToken}${quote(node.label)}${closeToken}`;
  };
  const known = new Set(graph.screens.map((flowScreen) => flowScreen.key));
  const emit = (flowScreen: FlowScreen, depth: number) => {
    const pad = "  ".repeat(depth);
    out.push(`${pad}subgraph ${flowScreen.key}[${quote(flowScreen.label)}]`);
    for (const inner of graph.screens.filter(
      (child) => child.parent === flowScreen.key,
    )) {
      emit(inner, depth + 1);
    }
    for (const node of graph.nodes.filter(
      (candidate) => candidate.screen === flowScreen.key,
    )) {
      out.push(`${pad}  ${nodeLine(node)}`);
    }
    out.push(`${pad}end`);
  };
  for (const flowScreen of graph.screens.filter(
    (candidate) => !candidate.parent || !known.has(candidate.parent),
  )) {
    emit(flowScreen, 1);
  }
  for (const node of graph.nodes.filter((candidate) => !candidate.screen)) {
    out.push(`  ${nodeLine(node)}`);
  }
  for (const edge of graph.edges) {
    out.push(`  ${edge.from} ${linkText(edge)} ${edge.to}`);
  }
  return `${out.join("\n")}\n`;
};
