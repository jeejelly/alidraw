import { unquote } from "./flowParseText";

import type { FlowEdgeStyle, FlowEnd } from "./flowGraph";

export type Link = {
  len: number;
  label: string;
  style: FlowEdgeStyle;
  head: boolean;
  tail: boolean;
  headEnd?: FlowEnd;
  tailEnd?: FlowEnd;
  /** dashes beyond the shortest spelling */
  length: number;
};

const END_OF: Record<string, FlowEnd> = {
  ">": "arrow",
  x: "cross",
  o: "circle",
};
const TAIL_OF: Record<string, FlowEnd> = {
  "<": "arrow",
  x: "cross",
  o: "circle",
};

const ends = (tail: string | undefined, head: string | undefined) => ({
  head: !!head,
  tail: !!tail,
  ...(head && END_OF[head] !== "arrow" ? { headEnd: END_OF[head] } : {}),
  ...(tail && TAIL_OF[tail] !== "arrow" ? { tailEnd: TAIL_OF[tail] } : {}),
});

const extraDashes = (count: number, head: boolean) =>
  Math.max(0, count - (head ? 2 : 3));

/**
 * A link at the start of `text`: --> --- -.-> ==> ~~~ --x --o x--x,
 * longer ones (---->, -..->), and labelled ones (-- text -->, -->|text|).
 */
export const readLink = (text: string): Link | null => {
  let match = /^~{3,}/.exec(text);
  if (match) {
    return {
      len: match[0].length,
      label: "",
      style: "invisible",
      head: false,
      tail: false,
      length: match[0].length - 3,
    };
  }
  match = /^([<xo])?-(\.+)(?:\s+(.+?)\s+\.+)?-([>xo])?(?:\|([^|]*)\|)?/.exec(
    text,
  );
  if (match) {
    const head = match[4];
    return {
      len: match[0].length,
      label: unquote(match[3] ?? match[5] ?? ""),
      style: "dashed",
      ...ends(match[1], head),
      length: match[2].length - 1,
    };
  }
  match = /^([<xo])?(--|==)\s+(.+?)\s+(-{2,}|={2,})([>xo])?/.exec(text);
  if (match) {
    const head = match[5];
    return {
      len: match[0].length,
      label: unquote(match[3]),
      style: match[2] === "==" ? "thick" : "solid",
      ...ends(match[1], head),
      length: extraDashes(match[4].length, !!head),
    };
  }
  match = /^([<xo])?(-{2,}|={2,})([>xo])?(?:\|([^|]*)\|)?/.exec(text);
  if (match) {
    const head = match[3];
    return {
      len: match[0].length,
      label: unquote(match[4] ?? ""),
      style: match[2][0] === "=" ? "thick" : "solid",
      ...ends(match[1], head),
      length: extraDashes(match[2].length, !!head),
    };
  }
  return null;
};
