import { BASIC_BRACKETS, FORMS } from "./flowForms";
import { quote } from "./flowParseText";

import type { FlowPort } from "./flowPorts";

import type {
  FlowBox,
  FlowEdge,
  FlowEnd,
  FlowGraph,
  FlowNode,
  FlowScreen,
} from "./flowGraph";

const HEAD_CHAR: Record<FlowEnd, string> = {
  arrow: ">",
  cross: "x",
  circle: "o",
};
const TAIL_CHAR: Record<FlowEnd, string> = {
  arrow: "<",
  cross: "x",
  circle: "o",
};

const linkText = (edge: FlowEdge) => {
  const extra = edge.length ?? 0;
  const head = edge.head ? HEAD_CHAR[edge.headEnd ?? "arrow"] : "";
  const tail = edge.tail ? TAIL_CHAR[edge.tailEnd ?? "arrow"] : "";
  const body =
    edge.style === "invisible"
      ? "~".repeat(3 + extra)
      : edge.style === "dashed"
      ? `-${".".repeat(1 + extra)}-${head}`
      : edge.style === "thick"
      ? `${"=".repeat((head ? 2 : 3) + extra)}${head}`
      : `${"-".repeat((head ? 2 : 3) + extra)}${head}`;
  return `${tail}${body}${edge.label ? `|${quote(edge.label)}|` : ""}`;
};

const classesOf = (node: FlowNode) =>
  (node.classes ?? []).map((name) => `:::${name}`).join("");

const nodeLine = (node: FlowNode) => {
  const info = node.form ? FORMS[node.form] : null;
  const label = quote(node.label);
  if (node.form && !info!.classic) {
    return `${node.key}@{ shape: ${
      info!.names[0]
    }, label: ${label} }${classesOf(node)}`;
  }
  const [open, close] = info?.classic ?? BASIC_BRACKETS[node.shape];
  return `${node.key}${open}${label}${close}${classesOf(node)}`;
};

const layoutLine = (key: string, box: FlowBox) =>
  `%% @layout ${key} ${[box.x, box.y, box.w, box.h]
    .map((value) => Math.round(value * 10) / 10)
    .join(" ")}`;

const portsLine = (key: string, ports: readonly FlowPort[]) =>
  `%% @ports ${key} ${ports
    .map(
      (port) =>
        `${port.name}:${Math.round(port.at[0] * 1000) / 1000}:${
          Math.round(port.at[1] * 1000) / 1000
        }`,
    )
    .join(" ")}`;

export type SerializeOptions = {
  /** also write where each step sits, as `%% @layout` comments (valid Mermaid) */
  layout?: boolean;
};

/** Mermaid text for a flow; anything Mermaid ignores (layout comments) comes last. */
export const serializeFlow = (
  graph: FlowGraph,
  options: SerializeOptions = {},
): string => {
  const out = [...graph.preamble, `flowchart ${graph.direction}`];
  if (graph.layout) {
    out.push(`  %% @flow layout ${graph.layout}`);
  }
  const known = new Set(graph.screens.map((screen) => screen.key));
  const emit = (screen: FlowScreen, depth: number) => {
    const pad = "  ".repeat(depth);
    out.push(`${pad}subgraph ${screen.key}[${quote(screen.label)}]`);
    if (screen.direction) {
      out.push(`${pad}  direction ${screen.direction}`);
    }
    for (const inner of graph.screens.filter(
      (child) => child.parent === screen.key,
    )) {
      emit(inner, depth + 1);
    }
    for (const node of graph.nodes.filter(
      (candidate) => candidate.screen === screen.key,
    )) {
      out.push(`${pad}  ${nodeLine(node)}`);
    }
    out.push(`${pad}end`);
  };
  for (const screen of graph.screens.filter(
    (candidate) => !candidate.parent || !known.has(candidate.parent),
  )) {
    emit(screen, 1);
  }
  for (const node of graph.nodes.filter((candidate) => !candidate.screen)) {
    out.push(`  ${nodeLine(node)}`);
  }
  for (const edge of graph.edges) {
    out.push(`  ${edge.from} ${linkText(edge)} ${edge.to}`);
  }
  for (const statement of graph.trailer) {
    out.push(...statement.split("\n").map((line) => `  ${line}`));
  }
  if (options.layout) {
    for (const item of [...graph.screens, ...graph.nodes]) {
      if (item.at) {
        out.push(layoutLine(item.key, item.at));
      }
    }
    for (const node of graph.nodes) {
      if (node.ports?.length) {
        out.push(portsLine(node.key, node.ports));
      }
    }
    graph.edges.forEach((edge, index) => {
      if (edge.fromPort || edge.toPort) {
        out.push(
          `%% @link ${index} ${edge.fromPort ?? "-"} ${edge.toPort ?? "-"}`,
        );
      }
    });
  }
  return `${out.join("\n")}\n`;
};
