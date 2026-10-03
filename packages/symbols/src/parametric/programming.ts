import {
  defineParametric,
  lineShape,
  rectShape,
  textShape,
  type Shape,
} from "../shapes";

import { accentParam, closed, nodeDef, withFlow } from "./diagramKit";
import { list, num, pick, text } from "./helpers";

import type { Token } from "../theme";

const ROW = 22;

const divider = (width: number, y: number): Shape =>
  lineShape(
    [
      [0, y],
      [width, y],
    ],
    { s: "border" },
  );

/** A header and compartments of text rows, as in UML classes and tables. */
const compartments = (
  width: number,
  header: { title: string; note?: string; ink: Token },
  sections: string[][],
) => {
  const headHeight = header.note ? 48 : 36;
  const out: Shape[] = [];
  let y = headHeight;
  const bodies: Shape[] = [];
  for (const rows of sections) {
    const top = y;
    bodies.push(divider(width, top));
    const height = Math.max(1, rows.length) * ROW + 10;
    rows.forEach((row, index) =>
      bodies.push(
        textShape(
          row,
          12,
          top + 5 + ROW / 2 + index * ROW,
          12,
          "text",
          "start",
          true,
        ),
      ),
    );
    y += height;
  }
  out.push(
    rectShape(0, 0, width, y, { r: "ctl", f: "surface", s: header.ink }),
    rectShape(0, 0, width, headHeight, { r: "ctl", f: "surfaceAlt", s: null }),
    ...(header.note
      ? [textShape(header.note, width / 2, 14, 11, "muted", "middle")]
      : []),
    textShape(
      header.title,
      width / 2,
      header.note ? 33 : headHeight / 2,
      14,
      "text",
      "middle",
    ),
    ...bodies,
  );
  return out;
};

export const umlClass = withFlow(
  defineParametric(
    "prog-class",
    "Class",
    "Programming",
    [
      text("name", "Name", "Order"),
      text(
        "attributes",
        "Attributes (comma separated)",
        "- id: int, - total: float",
      ),
      text("methods", "Methods (comma separated)", "+ pay(): bool, + cancel()"),
      num("width", "Width", 200, 120, 480),
      accentParam,
    ],
    (_theme, values) =>
      compartments(
        values.width,
        { title: values.name, ink: values.accent as Token },
        [list(values.attributes), list(values.methods)],
      ),
    "uml object oop fields methods",
  ),
  { shape: "rect", labelParam: "name" },
);

export const umlInterface = withFlow(
  defineParametric(
    "prog-interface",
    "Interface",
    "Programming",
    [
      text("name", "Name", "Payable"),
      text("methods", "Methods (comma separated)", "+ pay(): bool"),
      num("width", "Width", 200, 120, 480),
      accentParam,
    ],
    (_theme, values) =>
      compartments(
        values.width,
        {
          title: values.name,
          note: "«interface»",
          ink: values.accent as Token,
        },
        [list(values.methods)],
      ),
    "uml contract protocol abstract trait",
  ),
  { shape: "rect", labelParam: "name" },
);

export const func = nodeDef({
  id: "prog-function",
  name: "Function / method",
  category: "Programming",
  tags: "call procedure lambda callable",
  width: 200,
  height: 52,
  labelParam: "signature",
  label: "total(items): number",
  flow: { shape: "round" },
  body: (width, height, ink) => [
    rectShape(0, 0, width, height, { r: "pill", f: "surface", s: ink }),
  ],
});

export const loop = nodeDef({
  id: "prog-loop",
  name: "Loop",
  category: "Programming",
  tags: "for while iterate repeat loop-limit",
  width: 180,
  height: 60,
  label: "for each item",
  flow: { form: "loop-limit", shape: "rect" },
  body: (width, height, ink) => [
    closed(
      [
        [14, 0],
        [width - 14, 0],
        [width, 14],
        [width, height],
        [0, height],
        [0, 14],
      ],
      ink,
    ),
  ],
  place: (width, height) => [width / 2, height * 0.58, "middle"],
});

export const moduleBox = nodeDef({
  id: "prog-module",
  name: "Module / package",
  category: "Programming",
  tags: "namespace library folder tab uml package",
  width: 180,
  height: 100,
  label: "auth",
  flow: { shape: "rect" },
  body: (width, height, ink) => [
    rectShape(0, 0, width * 0.4, 20, { r: 0, f: "surfaceAlt", s: ink }),
    rectShape(0, 20, width, height - 20, { r: 0, f: "surface", s: ink }),
  ],
  place: (width, height) => [width / 2, 20 + (height - 20) / 2, "middle"],
});

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const endpoint = withFlow(
  defineParametric(
    "prog-endpoint",
    "API endpoint",
    "Programming",
    [
      pick("method", "Method", "GET", METHODS),
      text("path", "Path", "/users/{id}"),
      num("width", "Width", 240, 140, 560),
    ],
    (_theme, values) => {
      const ink: Token = values.method === "DELETE" ? "danger" : "accent";
      return [
        rectShape(0, 0, values.width, 40, { r: "ctl", f: "surface", s: ink }),
        rectShape(6, 6, 64, 28, { r: "ctl", f: ink, s: null }),
        textShape(values.method, 38, 20, 12, "onAccent", "middle"),
        textShape(values.path, 82, 20, 14, "text", "start", true),
      ];
    },
    "rest http route url get post request",
  ),
  { shape: "rect", labelParam: "path" },
);

export const dbTable = withFlow(
  defineParametric(
    "prog-db-table",
    "DB table",
    "Programming",
    [
      text("name", "Name", "users"),
      text("field1", "Field 1", "id  uuid  PK"),
      text("field2", "Field 2", "email  text"),
      text("field3", "Field 3", "created_at  date"),
      num("width", "Width", 200, 120, 480),
      accentParam,
    ],
    (_theme, values) =>
      compartments(
        values.width,
        { title: values.name, ink: values.accent as Token },
        [[values.field1, values.field2, values.field3].filter(Boolean)],
      ),
    "sql schema entity erd columns rows",
  ),
  { shape: "rect", labelParam: "name" },
);

export const codeNote = withFlow(
  defineParametric(
    "prog-note",
    "Note / Code block",
    "Programming",
    [
      text("title", "Title", "Snippet"),
      text("text", "Lines (separated by |)", "if (ok) {| run();|}"),
      num("width", "Width", 200, 120, 480),
    ],
    (_theme, values) => {
      const lines = String(values.text).split("|");
      const height = lines.length * 20 + 44;
      return [
        rectShape(0, 0, values.width, height, {
          r: 0,
          f: "surfaceAlt",
          s: "border",
        }),
        textShape(values.title, 12, 16, 11, "muted"),
        divider(values.width, 30),
        ...lines.map((line, index) =>
          textShape(line, 12, 46 + index * 20, 12, "text", "start", true),
        ),
      ];
    },
    "snippet source monospace comment annotation",
  ),
  { form: "card", shape: "rect", labelParam: "title" },
);

export const PROGRAMMING_COMPONENTS = [
  umlClass,
  umlInterface,
  func,
  loop,
  moduleBox,
  endpoint,
  dbTable,
  codeNote,
];
