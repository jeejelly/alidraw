/**
 * The Mermaid reader: the part of flowcharts that describes a flow (nodes,
 * shapes, subgraphs, links with labels, dotted and thick styles). Anything else
 * is reported and left out.
 */
import { emptyFlow } from "./flowGraph";

import type {
  FlowDirection,
  FlowEdgeStyle,
  FlowGraph,
  FlowIssue,
  FlowNode,
  FlowScreen,
  FlowShape,
} from "./flowGraph";

const unquote = (raw: string) => {
  let text = raw.trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/#quot;/g, '"')
    .replace(/&quot;/g, '"')
    .trim();
};

const SHAPES: [RegExp, FlowShape][] = [
  [/^\(\[(.*?)\]\)/s, "round"],
  [/^\(\((.*?)\)\)/s, "ellipse"],
  [/^\[\((.*?)\)\]/s, "rect"],
  [/^\[\[(.*?)\]\]/s, "rect"],
  [/^\{\{(.*?)\}\}/s, "diamond"],
  [/^\{(.*?)\}/s, "diamond"],
  [/^\[(.*?)\]/s, "rect"],
  [/^\((.*?)\)/s, "round"],
];

const ID = /^[A-Za-z_][A-Za-z0-9_]*/;

type Link = {
  len: number;
  label: string;
  style: FlowEdgeStyle;
  head: boolean;
  tail: boolean;
};

/** a link at the start of `text`: --> --- -.-> ==> -- text --> -->|text| ... */
const readLink = (text: string): Link | null => {
  let match = /^(<?)-\.(?:\s+(.+?)\s+\.)?-(>|x|o)?(?:\|([^|]*)\|)?/.exec(text);
  if (match) {
    return {
      len: match[0].length,
      label: unquote(match[2] ?? match[4] ?? ""),
      style: "dashed",
      head: !!match[3],
      tail: !!match[1],
    };
  }
  match = /^(<?)(--|==)\s+(.+?)\s+(-{2,}|={2,})(>|x|o)?/.exec(text);
  if (match) {
    return {
      len: match[0].length,
      label: unquote(match[3]),
      style: match[2] === "==" ? "thick" : "solid",
      head: !!match[5],
      tail: !!match[1],
    };
  }
  match = /^(<?)(-{2,}|={2,})(>|x|o)?(?:\|([^|]*)\|)?/.exec(text);
  if (match) {
    return {
      len: match[0].length,
      label: unquote(match[4] ?? ""),
      style: match[2][0] === "=" ? "thick" : "solid",
      head: !!match[3],
      tail: !!match[1],
    };
  }
  return null;
};

type ParseState = {
  graph: FlowGraph;
  issues: FlowIssue[];
  nodes: Map<string, FlowNode>;
  screens: Map<string, FlowScreen>;
  /** the subgraphs being read, innermost last */
  stack: string[];
  mentioned: Set<string>;
  sawHeader: boolean;
};

const UNUSED_STATEMENT =
  /^(direction|classDef|class|style|linkStyle|click|accTitle|accDescr)\b/;

const cannotRead = (rest: string, lineNo: number): FlowIssue => ({
  line: lineNo,
  message: `Cannot read "${rest.slice(0, 24)}"`,
});

const touch = (
  state: ParseState,
  key: string,
  label?: string,
  shape?: FlowShape,
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
  if (label !== undefined) {
    node.label = label;
  }
  if (shape) {
    node.shape = shape;
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
    let label: string | undefined;
    let shape: FlowShape | undefined;
    for (const [pattern, flowShape] of SHAPES) {
      const match = pattern.exec(rest);
      if (match) {
        label = unquote(match[1]);
        shape = flowShape;
        rest = rest.slice(match[0].length);
        break;
      }
    }
    touch(state, key, label, shape);
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
          state.graph.edges.push({
            from,
            to,
            label: pending.label,
            style: pending.style,
            head: pending.head,
            tail: pending.tail,
          });
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

const readLine = (state: ParseState, raw: string, lineNo: number) => {
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
  if (UNUSED_STATEMENT.test(line)) {
    state.issues.push({
      line: lineNo,
      message: `"${line.split(/\s/)[0]}" is not used here and was left out`,
      warn: true,
    });
    return;
  }
  readStatement(state, line, lineNo);
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
    sawHeader: false,
  };
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => readLine(state, raw, index + 1));
  if (state.stack.length) {
    state.issues.push({
      line: lines.length,
      message: `${state.stack.length} subgraph(s) not closed with "end"`,
    });
  }
  return { graph: state.graph, issues: state.issues };
};
