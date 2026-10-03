/**
 * The Mermaid reader: the part of flowcharts that describes a flow (nodes,
 * shapes, subgraphs, links with labels, dotted and thick styles). Anything else
 * is reported and left out.
 */
import { emptyFlow } from "./flowGraph";
import { readLink, type Link } from "./flowParseLink";
import { readNodeLook } from "./flowParseNode";
import { unquote } from "./flowParseText";

import type {
  FlowBox,
  FlowDirection,
  FlowEdge,
  FlowGraph,
  FlowIssue,
  FlowNode,
  FlowScreen,
  FlowShape,
} from "./flowGraph";
import type { FlowForm } from "./flowForms";
import type { FlowPort } from "./flowPorts";

const ID = /^[A-Za-z_][A-Za-z0-9_]*/;

type ParseState = {
  graph: FlowGraph;
  issues: FlowIssue[];
  nodes: Map<string, FlowNode>;
  screens: Map<string, FlowScreen>;
  /** the subgraphs being read, innermost last */
  stack: string[];
  mentioned: Set<string>;
  layout: Map<string, FlowBox>;
  nodePorts: Map<string, FlowPort[]>;
  linkPorts: Map<number, { from?: string; to?: string }>;
  sawHeader: boolean;
  /** inside `accDescr { … }`: the lines are kept as written */
  block: string[] | null;
};

/** statements the canvas does not draw; they are kept as written */
const KEPT_STATEMENT =
  /^(classDef|class|style|linkStyle|click|accTitle|accDescr)\b/;
const LAYOUT_COMMENT =
  /^%%\s*@layout\s+(\S+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/;

const cannotRead = (rest: string, lineNo: number): FlowIssue => ({
  line: lineNo,
  message: `Cannot read "${rest.slice(0, 24)}"`,
});

type NodeLook = {
  label?: string;
  shape?: FlowShape;
  form?: FlowForm;
  classes: string[];
};

const touch = (
  state: ParseState,
  key: string,
  look: NodeLook,
): FlowNode | null => {
  if (state.screens.has(key)) {
    return null;
  }
  let node = state.nodes.get(key);
  if (!node) {
    node = { key, label: key, shape: "rect" };
    state.nodes.set(key, node);
    state.graph.nodes.push(node);
  }
  if (look.label !== undefined) {
    node.label = look.label;
  }
  if (look.shape) {
    node.shape = look.shape;
    if (look.form) {
      node.form = look.form;
    } else {
      delete node.form;
    }
  }
  if (look.classes.length) {
    node.classes = [...new Set([...(node.classes ?? []), ...look.classes])];
  }
  // a node belongs to the screen where it is first mentioned
  if (!state.mentioned.has(key)) {
    state.mentioned.add(key);
    if (state.stack.length) {
      node.screen = state.stack[state.stack.length - 1];
    }
  }
  return node;
};

/** "flowchart LR": sets the direction */
const readHeader = (state: ParseState, header: RegExpExecArray) => {
  state.sawHeader = true;
  const direction = (header[2] ?? "TD").toUpperCase();
  state.graph.direction =
    direction === "TB" ? "TD" : (direction as FlowDirection);
  if (!["TD", "BT", "LR", "RL"].includes(state.graph.direction)) {
    state.graph.direction = "TD";
  }
};

const openSubgraph = (state: ParseState, declaration: string) => {
  const rest = declaration.trim();
  const match =
    /^([A-Za-z_][A-Za-z0-9_]*)\s*\[(.*)\]$/s.exec(rest) ??
    /^([A-Za-z_][A-Za-z0-9_]*)$/.exec(rest);
  const key = match ? match[1] : rest.replace(/\W+/g, "_");
  const label = match && match[2] !== undefined ? unquote(match[2]) : rest;
  if (!state.screens.has(key)) {
    const screen: FlowScreen = { key, label };
    if (state.stack.length) {
      screen.parent = state.stack[state.stack.length - 1];
    }
    state.screens.set(key, screen);
    state.graph.screens.push(screen);
  }
  state.stack.push(key);
};

const edgeOf = (from: string, to: string, link: Link): FlowEdge => ({
  from,
  to,
  label: link.label,
  style: link.style,
  head: link.head,
  tail: link.tail,
  ...(link.headEnd ? { headEnd: link.headEnd } : {}),
  ...(link.tailEnd ? { tailEnd: link.tailEnd } : {}),
  ...(link.length ? { length: link.length } : {}),
});

/** `a & b [label]`: the nodes of one side of a link, and what is left of the line */
const readNodeGroup = (
  state: ParseState,
  text: string,
  lineNo: number,
): { keys: string[]; rest: string } | null => {
  let rest = text;
  const keys: string[] = [];
  for (;;) {
    const id = ID.exec(rest);
    if (!id) {
      state.issues.push(cannotRead(rest, lineNo));
      return null;
    }
    const key = id[0];
    rest = rest.slice(key.length);
    const look = readNodeLook(rest);
    rest = look.rest;
    touch(state, key, look);
    keys.push(key);
    rest = rest.trimStart();
    if (!rest.startsWith("&")) {
      return { keys, rest };
    }
    rest = rest.slice(1).trimStart();
  }
};

/** a statement: node (& node)* (link node (& node)*)* */
const readStatement = (state: ParseState, line: string, lineNo: number) => {
  let rest = line.replace(/;$/, "").trim();
  let previous: string[] | null = null;
  let pending: Link | null = null;
  let guard = 0;
  while (rest && guard++ < 200) {
    const read = readNodeGroup(state, rest, lineNo);
    if (!read) {
      return;
    }
    const { keys } = read;
    if (previous && pending) {
      for (const from of previous) {
        for (const to of keys) {
          state.graph.edges.push(edgeOf(from, to, pending));
        }
      }
    }
    previous = keys;
    rest = read.rest.trimStart();
    if (!rest) {
      break;
    }
    const link = readLink(rest);
    if (!link) {
      state.issues.push(cannotRead(rest, lineNo));
      return;
    }
    pending = link;
    rest = rest.slice(link.len).trimStart();
    if (!rest) {
      state.issues.push({ line: lineNo, message: "A link needs a target" });
      return;
    }
  }
};

const PORTS_COMMENT =
  /^%%\s*@ports\s+(\S+)((?:\s+[^\s:]+:-?[\d.]+:-?[\d.]+)+)\s*$/;
const LINK_COMMENT = /^%%\s*@link\s+(\d+)\s+(\S+)\s+(\S+)\s*$/;

/** a whole-line comment: layout of a node, a directive, or a plain comment kept as written */
const readComment = (state: ParseState, line: string) => {
  const layout = LAYOUT_COMMENT.exec(line);
  if (layout) {
    const [, key, x, y, width, height] = layout;
    state.layout.set(key, { x: +x, y: +y, w: +width, h: +height });
    return;
  }
  const ports = PORTS_COMMENT.exec(line);
  if (ports) {
    state.nodePorts.set(
      ports[1],
      ports[2]
        .trim()
        .split(/\s+/)
        .map((spec) => {
          const [name, x, y] = spec.split(":");
          return { name, at: [+x, +y] as [number, number] };
        }),
    );
    return;
  }
  const link = LINK_COMMENT.exec(line);
  if (link) {
    state.linkPorts.set(+link[1], {
      from: link[2] === "-" ? undefined : link[2],
      to: link[3] === "-" ? undefined : link[3],
    });
  } else if (line.startsWith("%%{")) {
    state.graph.preamble.push(line);
  } else {
    state.graph.trailer.push(line);
  }
};

/** `direction LR` inside a subgraph */
const readDirection = (state: ParseState, line: string, lineNo: number) => {
  const direction = /^direction\s+(TB|TD|BT|LR|RL)\s*$/i.exec(line);
  const current = state.stack[state.stack.length - 1];
  if (!direction || !current) {
    state.issues.push({
      line: lineNo,
      message: '"direction" is used inside a subgraph only',
      warn: true,
    });
    return;
  }
  const value = direction[1].toUpperCase();
  state.screens.get(current)!.direction = (
    value === "TB" ? "TD" : value
  ) as FlowDirection;
};

const readLine = (state: ParseState, raw: string, lineNo: number) => {
  if (state.block) {
    state.block.push(raw.trim());
    if (raw.trim() === "}") {
      state.graph.trailer.push(state.block.join("\n"));
      state.block = null;
    }
    return;
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("%%")) {
    readComment(state, trimmed);
    return;
  }
  const line = raw.replace(/%%.*$/, "").trim();
  if (!line) {
    return;
  }
  const header = /^(flowchart|graph)\b\s*([A-Za-z]{2})?/i.exec(line);
  if (header) {
    readHeader(state, header);
    return;
  }
  if (!state.sawHeader) {
    state.issues.push({
      line: lineNo,
      message: 'Start with "flowchart TD" (or LR, RL, BT)',
    });
    state.sawHeader = true;
  }
  const subgraph = /^subgraph\s+(.+)$/i.exec(line);
  if (subgraph) {
    openSubgraph(state, subgraph[1]);
    return;
  }
  if (/^end$/i.test(line)) {
    if (!state.stack.pop()) {
      state.issues.push({ line: lineNo, message: '"end" without a subgraph' });
    }
    return;
  }
  if (/^direction\b/i.test(line)) {
    readDirection(state, line, lineNo);
    return;
  }
  if (KEPT_STATEMENT.test(line)) {
    if (/^accDescr\s*\{\s*$/.test(line)) {
      state.block = [line];
    } else {
      state.graph.trailer.push(line);
    }
    return;
  }
  readStatement(state, line, lineNo);
};

const applyLayout = (state: ParseState) => {
  for (const [key, ports] of state.nodePorts) {
    const node = state.nodes.get(key);
    if (node) {
      node.ports = ports;
    }
  }
  for (const [index, ends] of state.linkPorts) {
    const edge = state.graph.edges[index];
    if (edge) {
      if (ends.from) {
        edge.fromPort = ends.from;
      }
      if (ends.to) {
        edge.toPort = ends.to;
      }
    }
  }
  for (const [key, box] of state.layout) {
    const target = state.nodes.get(key) ?? state.screens.get(key);
    if (target) {
      target.at = box;
    }
  }
};

export const parseFlow = (
  text: string,
): { graph: FlowGraph; issues: FlowIssue[] } => {
  const state: ParseState = {
    graph: emptyFlow(),
    issues: [],
    nodes: new Map(),
    screens: new Map(),
    stack: [],
    mentioned: new Set(),
    layout: new Map(),
    nodePorts: new Map(),
    linkPorts: new Map(),
    sawHeader: false,
    block: null,
  };
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => readLine(state, raw, index + 1));
  if (state.stack.length) {
    state.issues.push({
      line: lines.length,
      message: `${state.stack.length} subgraph(s) not closed with "end"`,
    });
  }
  applyLayout(state);
  return { graph: state.graph, issues: state.issues };
};
