import { BASIC_BRACKETS, FORMS, formFromName, isForm } from "./flowForms";
import { unquote } from "./flowParseText";

import type { FlowForm } from "./flowForms";
import type { FlowShape } from "./flowGraph";

export type NodeLook = {
  label?: string;
  shape?: FlowShape;
  form?: FlowForm;
  classes: string[];
  /** what is left of the line */
  rest: string;
};

type Bracket = {
  open: string;
  close: string;
  shape: FlowShape;
  form?: FlowForm;
};

/** longest openers first, so `(((` is tried before `((` and `(` */
const BRACKETS: Bracket[] = [
  ...Object.entries(FORMS)
    .filter(([, info]) => info.classic)
    .map(([form, info]) => ({
      open: info.classic![0],
      close: info.classic![1],
      shape: info.shape,
      form: form as FlowForm,
    })),
  ...Object.entries(BASIC_BRACKETS).map(([shape, [open, close]]) => ({
    open,
    close,
    shape: shape as FlowShape,
  })),
].sort((first, second) => second.open.length - first.open.length);

/** where the label ends: after a quoted label, or at the closing token */
const closeIndex = (rest: string, from: number, close: string) => {
  if (rest[from] === '"') {
    const quoteEnd = rest.indexOf('"', from + 1);
    if (quoteEnd >= 0) {
      const afterQuote = rest.slice(quoteEnd + 1);
      const gap = afterQuote.length - afterQuote.trimStart().length;
      if (afterQuote.startsWith(close, gap)) {
        return quoteEnd + 1 + gap;
      }
    }
  }
  return rest.indexOf(close, from);
};

const readBracket = (rest: string) => {
  const candidates = BRACKETS.filter((bracket) =>
    rest.startsWith(bracket.open),
  );
  let best: { bracket: Bracket; end: number } | null = null;
  for (const bracket of candidates) {
    const end = closeIndex(rest, bracket.open.length, bracket.close);
    if (end >= 0 && (!best || end < best.end)) {
      best = { bracket, end };
    }
  }
  if (!best) {
    return null;
  }
  const { bracket, end } = best;
  return {
    label: unquote(rest.slice(bracket.open.length, end)),
    shape: bracket.shape,
    form: bracket.form,
    rest: rest.slice(end + bracket.close.length),
  };
};

/** `@{ shape: cyl, label: "x" }` */
const readShapeBlock = (rest: string) => {
  const match = /^@\{([^}]*)\}/.exec(rest);
  if (!match) {
    return null;
  }
  const fields = new Map<string, string>();
  for (const part of match[1].split(/,(?=\s*\w+\s*:)/)) {
    const separator = part.indexOf(":");
    if (separator > 0) {
      fields.set(
        part.slice(0, separator).trim(),
        part.slice(separator + 1).trim(),
      );
    }
  }
  const named = formFromName(unquote(fields.get("shape") ?? ""));
  const shape: FlowShape | undefined = named
    ? isForm(named)
      ? FORMS[named].shape
      : named
    : undefined;
  return {
    label: fields.has("label") ? unquote(fields.get("label")!) : undefined,
    shape,
    form: named && isForm(named) ? named : undefined,
    rest: rest.slice(match[0].length),
  };
};

/** what follows a node id: its shape and label, and `:::class` names */
export const readNodeLook = (text: string): NodeLook => {
  const look = readBracket(text) ?? readShapeBlock(text);
  const rest = look ? look.rest : text;
  const classes: string[] = [];
  let tail = rest;
  for (let match = /^:::([A-Za-z0-9_-]+)/.exec(tail); match; ) {
    classes.push(match[1]);
    tail = tail.slice(match[0].length);
    match = /^:::([A-Za-z0-9_-]+)/.exec(tail);
  }
  return {
    label: look?.label,
    shape: look?.shape,
    form: look?.form,
    classes,
    rest: tail,
  };
};
