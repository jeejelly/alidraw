/**
 * A flow: screens, steps (hotspots) and the links between them, with a
 * Mermaid flowchart as its text form. The parser reads the part of Mermaid
 * flowcharts that describes this (nodes, shapes, subgraphs, links with
 * labels, dotted and thick styles); anything else is reported and left out.
 */
export type FlowShape = "rect" | "round" | "diamond" | "ellipse";
export type FlowDirection = "TD" | "BT" | "LR" | "RL";
export type FlowEdgeStyle = "solid" | "dashed" | "thick";

export type FlowNode = {
  key: string;
  label: string;
  shape: FlowShape;
  /** the screen (subgraph) it sits in */
  screen?: string;
};
export type FlowScreen = {
  key: string;
  label: string;
  /** the screen it is nested in (a screen can hold screens) */
  parent?: string;
};
export type FlowEdge = {
  from: string;
  to: string;
  label: string;
  style: FlowEdgeStyle;
  head: boolean;
  tail: boolean;
};
export type FlowGraph = {
  direction: FlowDirection;
  nodes: FlowNode[];
  screens: FlowScreen[];
  edges: FlowEdge[];
};
export type FlowIssue = {
  line: number;
  message: string;
  /** left out, but the rest is still usable */
  warn?: boolean;
};

export const emptyFlow = (): FlowGraph => ({
  direction: "TD",
  nodes: [],
  screens: [],
  edges: [],
});

/** a Mermaid-safe id from a label: "Pay now!" -> "pay_now" */
export const slugKey = (label: string, taken: ReadonlySet<string>) => {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "step";
  let key = /^[a-z_]/.test(base) ? base : `n_${base}`;
  for (let i = 2; taken.has(key) || key === "end"; i++) {
    key = `${base}_${i}`;
  }
  return key;
};

// -----------------------------------------------------------------------------
// text
// -----------------------------------------------------------------------------

const unquote = (raw: string) => {
  let s = raw.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/#quot;/g, '"')
    .replace(/&quot;/g, '"')
    .trim();
};

const quote = (label: string) =>
  `"${label.replace(/"/g, "#quot;").replace(/\r?\n/g, "<br/>") || " "}"`;

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

/** a link at the start of `s`: --> --- -.-> ==> -- text --> -->|text| ... */
const readLink = (s: string): Link | null => {
  let m = /^(<?)-\.(?:\s+(.+?)\s+\.)?-(>|x|o)?(?:\|([^|]*)\|)?/.exec(s);
  if (m) {
    return {
      len: m[0].length,
      label: unquote(m[2] ?? m[4] ?? ""),
      style: "dashed",
      head: !!m[3],
      tail: !!m[1],
    };
  }
  m = /^(<?)(--|==)\s+(.+?)\s+(-{2,}|={2,})(>|x|o)?/.exec(s);
  if (m) {
    return {
      len: m[0].length,
      label: unquote(m[3]),
      style: m[2] === "==" ? "thick" : "solid",
      head: !!m[5],
      tail: !!m[1],
    };
  }
  m = /^(<?)(-{2,}|={2,})(>|x|o)?(?:\|([^|]*)\|)?/.exec(s);
  if (m) {
    return {
      len: m[0].length,
      label: unquote(m[4] ?? ""),
      style: m[2][0] === "=" ? "thick" : "solid",
      head: !!m[3],
      tail: !!m[1],
    };
  }
  return null;
};

export const parseFlow = (
  text: string,
): { graph: FlowGraph; issues: FlowIssue[] } => {
  const graph = emptyFlow();
  const issues: FlowIssue[] = [];
  const nodes = new Map<string, FlowNode>();
  const screens = new Map<string, FlowScreen>();
  const stack: string[] = [];
  const mentioned = new Set<string>();
  let sawHeader = false;

  const touch = (
    key: string,
    label?: string,
    shape?: FlowShape,
  ): FlowNode | null => {
    if (screens.has(key)) {
      return null;
    }
    let node = nodes.get(key);
    if (!node) {
      node = { key, label: key, shape: "rect" };
      nodes.set(key, node);
      graph.nodes.push(node);
    }
    if (label !== undefined) {
      node.label = label;
    }
    if (shape) {
      node.shape = shape;
    }
    // a node belongs to the screen where it is first mentioned
    if (!mentioned.has(key)) {
      mentioned.add(key);
      if (stack.length) {
        node.screen = stack[stack.length - 1];
      }
    }
    return node;
  };

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.replace(/%%.*$/, "").trim();
    if (!line) {
      return;
    }
    // several statements on a line
    const header = /^(flowchart|graph)\b\s*([A-Za-z]{2})?/i.exec(line);
    if (header) {
      sawHeader = true;
      const dir = (header[2] ?? "TD").toUpperCase();
      graph.direction = dir === "TB" ? "TD" : (dir as FlowDirection);
      if (!["TD", "BT", "LR", "RL"].includes(graph.direction)) {
        graph.direction = "TD";
      }
      return;
    }
    if (!sawHeader) {
      issues.push({
        line: lineNo,
        message: 'Start with "flowchart TD" (or LR, RL, BT)',
      });
      sawHeader = true;
    }
    const sub = /^subgraph\s+(.+)$/i.exec(line);
    if (sub) {
      const rest = sub[1].trim();
      const m =
        /^([A-Za-z_][A-Za-z0-9_]*)\s*\[(.*)\]$/s.exec(rest) ??
        /^([A-Za-z_][A-Za-z0-9_]*)$/.exec(rest);
      const key = m ? m[1] : rest.replace(/\W+/g, "_");
      const label = m && m[2] !== undefined ? unquote(m[2]) : rest;
      if (!screens.has(key)) {
        const screen: FlowScreen = { key, label };
        if (stack.length) {
          screen.parent = stack[stack.length - 1];
        }
        screens.set(key, screen);
        graph.screens.push(screen);
      }
      stack.push(key);
      return;
    }
    if (/^end$/i.test(line)) {
      if (!stack.pop()) {
        issues.push({ line: lineNo, message: '"end" without a subgraph' });
      }
      return;
    }
    if (
      /^(direction|classDef|class|style|linkStyle|click|accTitle|accDescr)\b/.test(
        line,
      )
    ) {
      issues.push({
        line: lineNo,
        message: `"${line.split(/\s/)[0]}" is not used here and was left out`,
        warn: true,
      });
      return;
    }

    // a statement: node (& node)* (link node (& node)*)*
    let rest = line.replace(/;$/, "").trim();
    let previous: string[] | null = null;
    let pending: Link | null = null;
    let guard = 0;
    while (rest && guard++ < 200) {
      const group: string[] = [];
      for (;;) {
        const id = ID.exec(rest);
        if (!id) {
          issues.push({
            line: lineNo,
            message: `Cannot read "${rest.slice(0, 24)}"`,
          });
          return;
        }
        const key = id[0];
        rest = rest.slice(key.length);
        let label: string | undefined;
        let shape: FlowShape | undefined;
        for (const [re, s] of SHAPES) {
          const m = re.exec(rest);
          if (m) {
            label = unquote(m[1]);
            shape = s;
            rest = rest.slice(m[0].length);
            break;
          }
        }
        touch(key, label, shape);
        group.push(key);
        rest = rest.trimStart();
        if (rest.startsWith("&")) {
          rest = rest.slice(1).trimStart();
          continue;
        }
        break;
      }
      if (previous && pending) {
        for (const from of previous) {
          for (const to of group) {
            graph.edges.push({
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
      previous = group;
      rest = rest.trimStart();
      if (!rest) {
        break;
      }
      const link = readLink(rest);
      if (!link) {
        issues.push({
          line: lineNo,
          message: `Cannot read "${rest.slice(0, 24)}"`,
        });
        return;
      }
      pending = link;
      rest = rest.slice(link.len).trimStart();
      if (!rest) {
        issues.push({ line: lineNo, message: "A link needs a target" });
        return;
      }
    }
  });
  if (stack.length) {
    issues.push({
      line: lines.length,
      message: `${stack.length} subgraph(s) not closed with "end"`,
    });
  }
  return { graph, issues };
};

const SHAPE_OPEN: Record<FlowShape, [string, string]> = {
  rect: ["[", "]"],
  round: ["(", ")"],
  diamond: ["{", "}"],
  ellipse: ["((", "))"],
};

const linkText = (e: FlowEdge) => {
  const left = e.tail ? "<" : "";
  const arrow =
    e.style === "dashed"
      ? e.head
        ? "-.->"
        : "-.-"
      : e.style === "thick"
      ? e.head
        ? "==>"
        : "==="
      : e.head
      ? "-->"
      : "---";
  return `${left}${arrow}${e.label ? `|${quote(e.label)}|` : ""}`;
};

export const serializeFlow = (graph: FlowGraph): string => {
  const out = [`flowchart ${graph.direction}`];
  const nodeLine = (n: FlowNode) => {
    const [a, b] = SHAPE_OPEN[n.shape];
    return `${n.key}${a}${quote(n.label)}${b}`;
  };
  const known = new Set(graph.screens.map((s) => s.key));
  const emit = (s: FlowScreen, depth: number) => {
    const pad = "  ".repeat(depth);
    out.push(`${pad}subgraph ${s.key}[${quote(s.label)}]`);
    for (const inner of graph.screens.filter((c) => c.parent === s.key)) {
      emit(inner, depth + 1);
    }
    for (const n of graph.nodes.filter((n) => n.screen === s.key)) {
      out.push(`${pad}  ${nodeLine(n)}`);
    }
    out.push(`${pad}end`);
  };
  for (const s of graph.screens.filter(
    (s) => !s.parent || !known.has(s.parent),
  )) {
    emit(s, 1);
  }
  for (const n of graph.nodes.filter((n) => !n.screen)) {
    out.push(`  ${nodeLine(n)}`);
  }
  for (const e of graph.edges) {
    out.push(`  ${e.from} ${linkText(e)} ${e.to}`);
  }
  return `${out.join("\n")}\n`;
};
