import {
  defineParametric,
  ellipseShape,
  lineShape,
  rectShape,
  textShape,
} from "../shapes";

import {
  closed,
  cylinder,
  DECISION_PORTS,
  ellipseArc,
  FORK_PORTS,
  LOOP_PORTS,
  nodeDef,
  withFlow,
} from "./diagramKit";
import { num, text } from "./helpers";

export const terminator = nodeDef({
  id: "flow-terminator",
  name: "Terminator",
  category: "Flow",
  tags: "start end stop begin flowchart stadium",
  width: 140,
  height: 48,
  label: "Start",
  flow: { form: "stadium", shape: "round" },
  body: (width, height, ink) => [
    rectShape(0, 0, width, height, { r: "pill", f: "surface", s: ink }),
  ],
});

export const process = nodeDef({
  id: "flow-process",
  name: "Process",
  category: "Flow",
  tags: "step action task flowchart rectangle",
  width: 160,
  height: 64,
  label: "Process",
  flow: { shape: "rect" },
  body: (width, height, ink) => [
    rectShape(0, 0, width, height, { r: "ctl", f: "surface", s: ink }),
  ],
});

export const decision = nodeDef({
  id: "flow-decision",
  name: "Decision",
  category: "Flow",
  tags: "if condition branch yes no diamond flowchart",
  width: 160,
  height: 100,
  label: "Condition?",
  flow: { shape: "diamond", ports: DECISION_PORTS },
  body: (width, height, ink) => [
    closed(
      [
        [width / 2, 0],
        [width, height / 2],
        [width / 2, height],
        [0, height / 2],
      ],
      ink,
    ),
  ],
});

export const inputOutput = nodeDef({
  id: "flow-input-output",
  name: "Input / Output",
  category: "Flow",
  tags: "data read write parallelogram io flowchart",
  width: 170,
  height: 60,
  label: "Read data",
  flow: { form: "parallelogram", shape: "rect" },
  body: (width, height, ink) => {
    const skew = Math.min(height * 0.4, width / 4);
    return [
      closed(
        [
          [skew, 0],
          [width, 0],
          [width - skew, height],
          [0, height],
        ],
        ink,
      ),
    ];
  },
});

export const predefinedProcess = nodeDef({
  id: "flow-predefined-process",
  name: "Predefined process",
  category: "Flow",
  tags: "subroutine subprocess call function flowchart",
  width: 170,
  height: 64,
  label: "Subroutine",
  flow: { form: "subroutine", shape: "rect" },
  body: (width, height, ink) => [
    rectShape(0, 0, width, height, { r: 0, f: "surface", s: ink }),
    lineShape(
      [
        [12, 0],
        [12, height],
      ],
      { s: ink },
    ),
    lineShape(
      [
        [width - 12, 0],
        [width - 12, height],
      ],
      { s: ink },
    ),
  ],
});

export const database = nodeDef({
  id: "flow-database",
  name: "Database",
  category: "Flow",
  tags: "storage data cylinder db flowchart",
  width: 120,
  height: 100,
  label: "Users",
  flow: { form: "cylinder", shape: "rect" },
  body: (width, height, ink) => cylinder(width, height, ink),
  place: (width, height) => [width / 2, height * 0.58, "middle"],
});

export const document = nodeDef({
  id: "flow-document",
  name: "Document",
  category: "Flow",
  tags: "report file paper output flowchart",
  width: 150,
  height: 80,
  label: "Report",
  flow: { form: "document", shape: "rect" },
  body: (width, height, ink) => {
    const wave = Math.min(10, height / 6);
    const edge = Array.from({ length: 17 }, (_, index): [number, number] => {
      const share = index / 16;
      return [
        width * (1 - share),
        height - wave + Math.sin(share * Math.PI * 2) * wave,
      ];
    });
    return [closed([[0, 0], [width, 0], ...edge], ink)];
  },
  place: (width, height) => [width / 2, height * 0.45, "middle"],
});

export const manualInput = nodeDef({
  id: "flow-manual-input",
  name: "Manual input",
  category: "Flow",
  tags: "keyboard type enter user input flowchart",
  width: 160,
  height: 64,
  label: "Enter value",
  flow: { form: "manual-input", shape: "rect" },
  body: (width, height, ink) => [
    closed(
      [
        [0, 14],
        [width, 0],
        [width, height],
        [0, height],
      ],
      ink,
    ),
  ],
  place: (width, height) => [width / 2, height * 0.55, "middle"],
});

export const delay = nodeDef({
  id: "flow-delay",
  name: "Delay",
  category: "Flow",
  tags: "wait pause timer flowchart",
  width: 140,
  height: 60,
  label: "Wait",
  flow: { form: "delay", shape: "rect" },
  body: (width, height, ink) => [
    closed(
      [
        [0, 0],
        [width - height / 2, 0],
        ...ellipseArc(
          width - height / 2,
          height / 2,
          height / 2,
          height / 2,
          -Math.PI / 2,
          Math.PI / 2,
        ),
        [0, height],
      ],
      ink,
    ),
  ],
});

export const display = nodeDef({
  id: "flow-display",
  name: "Display",
  category: "Flow",
  tags: "screen show monitor output flowchart",
  width: 160,
  height: 64,
  label: "Show result",
  flow: { form: "display", shape: "rect" },
  body: (width, height, ink) => {
    const tip = Math.min(24, width / 5);
    return [
      closed(
        [
          [0, height / 2],
          [tip, 0],
          [width - tip, 0],
          ...ellipseArc(
            width - tip,
            height / 2,
            tip,
            height / 2,
            -Math.PI / 2,
            Math.PI / 2,
          ),
          [tip, height],
        ],
        ink,
      ),
    ];
  },
});

export const connector = withFlow(
  defineParametric(
    "flow-connector",
    "Connector",
    "Flow",
    [text("label", "Label", "A"), num("size", "Size", 40, 24, 120)],
    (_theme, values) => [
      ellipseShape(0, 0, values.size, values.size, {
        f: "surface",
        s: "accent",
      }),
      textShape(
        values.label,
        values.size / 2,
        values.size / 2,
        13,
        "text",
        "middle",
      ),
    ],
    "jump page connector reference circle flowchart",
  ),
  { form: "start", shape: "ellipse", labelParam: "label" },
);

export const forkJoin = withFlow(
  defineParametric(
    "flow-fork-join",
    "Merge / Fork-Join",
    "Flow",
    [text("label", "Label", "Join"), num("width", "Width", 140, 40, 400)],
    (_theme, values) => [
      rectShape(0, 0, values.width, 8, { f: "accent", s: null, r: 2 }),
      textShape(values.label, values.width + 10, 4, 12, "muted"),
    ],
    "merge split parallel synchronize bar flowchart",
  ),
  { form: "fork", shape: "rect", ports: FORK_PORTS, labelParam: "label" },
);

export const comment = nodeDef({
  id: "flow-comment",
  name: "Comment",
  category: "Flow",
  tags: "annotation note remark brace flowchart",
  width: 160,
  height: 56,
  label: "Note",
  flow: { form: "comment", shape: "rect" },
  body: (width, height, ink) => [
    lineShape(
      [
        [16, 0],
        [0, 0],
        [0, height],
        [16, height],
      ],
      { s: ink },
    ),
  ],
  place: (_width, height) => [24, height / 2, "start"],
});

/** Mermaid has no `for` or `while` element: a loop head is the hexagon (a counted loop) or the loop-limit shape (a condition), with the body and the way back as links. */
export const forLoop = nodeDef({
  id: "flow-for-loop",
  name: "For loop",
  category: "Flow",
  tags: "for each iterate repeat counted loop hexagon prepare",
  width: 200,
  height: 64,
  label: "for each item",
  flow: { form: "hexagon", shape: "rect", ports: LOOP_PORTS },
  body: (width, height, ink) => [
    closed(
      [
        [18, 0],
        [width - 18, 0],
        [width, height / 2],
        [width - 18, height],
        [18, height],
        [0, height / 2],
      ],
      ink,
    ),
  ],
});

export const whileLoop = nodeDef({
  id: "flow-while-loop",
  name: "While loop",
  category: "Flow",
  tags: "while until condition repeat loop-limit",
  width: 200,
  height: 64,
  label: "while condition",
  flow: { form: "loop-limit", shape: "rect", ports: LOOP_PORTS },
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

export const FLOW_COMPONENTS = [
  terminator,
  process,
  decision,
  forLoop,
  whileLoop,
  inputOutput,
  predefinedProcess,
  database,
  document,
  manualInput,
  delay,
  display,
  connector,
  forkJoin,
  comment,
];
