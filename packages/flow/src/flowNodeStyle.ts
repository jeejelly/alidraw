import type { FlowGraph } from "./flowGraph";

export type NodeLook = {
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  /** the label's colour */
  color?: string;
};

const declarations = (text: string) => {
  const out: Record<string, string> = {};
  for (const part of text.split(",")) {
    const at = part.indexOf(":");
    if (at > 0) {
      out[part.slice(0, at).trim().toLowerCase()] = part.slice(at + 1).trim();
    }
  }
  return out;
};

const lookOf = (rules: Record<string, string>): NodeLook => {
  const look: NodeLook = {};
  const colour = (value: string | undefined) =>
    value && value !== "none" && /^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(value)
      ? value
      : value === "none"
      ? "transparent"
      : undefined;
  const fill = colour(rules.fill);
  const stroke = colour(rules.stroke);
  const text = colour(rules.color);
  if (fill) {
    look.backgroundColor = fill;
  }
  if (stroke) {
    look.strokeColor = stroke;
  }
  if (text && text !== "transparent") {
    look.color = text;
  }
  const width = parseFloat(rules["stroke-width"] ?? "");
  if (width > 0) {
    look.strokeWidth = Math.min(8, width);
  }
  return look;
};

/** the colours Mermaid's `classDef`, `class` and `style` statements give each step */
export const nodeLooks = (graph: FlowGraph): Map<string, NodeLook> => {
  const classes = new Map<string, Record<string, string>>();
  const classOf = new Map<string, string[]>();
  const direct = new Map<string, Record<string, string>>();
  for (const line of graph.trailer) {
    const def = /^classDef\s+([\w,-]+)\s+(.+?);?$/.exec(line);
    if (def) {
      for (const name of def[1].split(",")) {
        classes.set(name, { ...classes.get(name), ...declarations(def[2]) });
      }
      continue;
    }
    const assign = /^class\s+([\w,]+)\s+([\w-]+);?$/.exec(line);
    if (assign) {
      for (const key of assign[1].split(",")) {
        classOf.set(key, [...(classOf.get(key) ?? []), assign[2]]);
      }
      continue;
    }
    const style = /^style\s+(\w+)\s+(.+?);?$/.exec(line);
    if (style) {
      direct.set(style[1], {
        ...direct.get(style[1]),
        ...declarations(style[2]),
      });
    }
  }
  const looks = new Map<string, NodeLook>();
  for (const node of graph.nodes) {
    const rules: Record<string, string> = {};
    for (const name of [
      ...(classOf.get(node.key) ?? []),
      ...(node.classes ?? []),
    ]) {
      Object.assign(rules, classes.get(name));
    }
    Object.assign(rules, direct.get(node.key));
    const look = lookOf(rules);
    if (Object.keys(look).length) {
      looks.set(node.key, look);
    }
  }
  return looks;
};
