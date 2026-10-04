import {
  defineParametric,
  ellipseShape,
  lineShape,
  rectShape,
  textShape,
  type Shape,
} from "../shapes";

import { DECISION_PORTS, FORK_PORTS, withFlow, closed } from "./diagramKit";
import { num, pick, text } from "./helpers";

/** the name of a small state symbol, written under it */
const caption = (name: string, centerX: number, top: number): Shape =>
  textShape(name, centerX, top, 12, "muted", "middle");

export const initialState = withFlow(
  defineParametric(
    "state-initial",
    "Initial state",
    "State",
    [text("name", "Name", "Start"), num("size", "Size", 24, 12, 80)],
    (_theme, values) => [
      ellipseShape(0, 0, values.size, values.size, { f: "text", s: null }),
      caption(values.name, values.size / 2, values.size + 14),
    ],
    "start begin pseudostate uml statechart",
  ),
  { form: "start", shape: "ellipse", labelParam: "name" },
);

export const finalState = withFlow(
  defineParametric(
    "state-final",
    "Final state",
    "State",
    [text("name", "Name", "End"), num("size", "Size", 28, 16, 80)],
    (_theme, values) => {
      const inset = values.size / 4;
      return [
        ellipseShape(0, 0, values.size, values.size, { f: null, s: "text" }),
        ellipseShape(
          inset,
          inset,
          values.size - inset * 2,
          values.size - inset * 2,
          { f: "text", s: null },
        ),
        caption(values.name, values.size / 2, values.size + 14),
      ];
    },
    "end stop terminate uml statechart",
  ),
  { form: "stop", shape: "ellipse", labelParam: "name" },
);

export const stateBox = withFlow(
  defineParametric(
    "state-box",
    "State",
    "State",
    [
      text("name", "Name", "Idle"),
      text("entry", "Entry action", "entry / start()"),
      text("exit", "Exit action", ""),
      num("width", "Width", 160, 80, 480),
    ],
    (_theme, values) => {
      const actions = [values.entry, values.exit].filter(Boolean);
      const height = 40 + (actions.length ? 12 + actions.length * 20 : 0);
      const out: Shape[] = [
        rectShape(0, 0, values.width, height, {
          r: "card",
          f: "wash",
          s: "accent",
        }),
        textShape(values.name, values.width / 2, 20, 14, "text", "middle"),
      ];
      if (actions.length) {
        out.push(
          lineShape(
            [
              [0, 40],
              [values.width, 40],
            ],
            { s: "border" },
          ),
        );
      }
      actions.forEach((action, index) =>
        out.push(textShape(action, 12, 58 + index * 20, 12, "muted")),
      );
      return out;
    },
    "uml statechart status node entry exit",
  ),
  { shape: "round", labelParam: "name" },
);

export const choice = withFlow(
  defineParametric(
    "state-choice",
    "Choice",
    "State",
    [text("name", "Name", "Choice"), num("size", "Size", 44, 24, 120)],
    (_theme, values) => [
      closed(
        [
          [values.size / 2, 0],
          [values.size, values.size / 2],
          [values.size / 2, values.size],
          [0, values.size / 2],
        ],
        "accent",
      ),
      caption(values.name, values.size / 2, values.size + 14),
    ],
    "decision branch conditional uml statechart",
  ),
  { shape: "diamond", ports: DECISION_PORTS, labelParam: "name" },
);

export const stateFork = withFlow(
  defineParametric(
    "state-fork",
    "Fork / Join",
    "State",
    [
      text("name", "Name", "Fork"),
      num("width", "Length", 120, 40, 400),
      pick("direction", "Direction", "horizontal", ["horizontal", "vertical"]),
    ],
    (_theme, values) =>
      values.direction === "vertical"
        ? [
            rectShape(0, 0, 8, values.width, { f: "text", s: null }),
            textShape(values.name, 18, values.width / 2, 12, "muted"),
          ]
        : [
            rectShape(0, 0, values.width, 8, { f: "text", s: null }),
            caption(values.name, values.width / 2, 22),
          ],
    "join parallel concurrent split bar uml statechart",
  ),
  { form: "fork", shape: "rect", ports: FORK_PORTS, labelParam: "name" },
);

export const history = withFlow(
  defineParametric(
    "state-history",
    "History",
    "State",
    [text("name", "Name", "History"), num("size", "Size", 36, 24, 100)],
    (_theme, values) => [
      ellipseShape(0, 0, values.size, values.size, {
        f: "wash",
        s: "accent",
      }),
      textShape(
        "H",
        values.size / 2,
        values.size / 2,
        values.size * 0.45,
        "accent",
        "middle",
      ),
      caption(values.name, values.size / 2, values.size + 14),
    ],
    "shallow deep resume memory uml statechart",
  ),
  { shape: "ellipse", labelParam: "name" },
);

export const compositeState = withFlow(
  defineParametric(
    "state-composite",
    "Composite state",
    "State",
    [
      text("title", "Title", "Connected"),
      num("width", "Width", 360, 160, 800),
      num("height", "Height", 220, 100, 600),
    ],
    (_theme, values) => [
      rectShape(0, 0, values.width, values.height, {
        r: "card",
        f: "surfaceAlt",
        s: "accent",
      }),
      lineShape(
        [
          [0, 36],
          [values.width, 36],
        ],
        { s: "accent" },
      ),
      textShape(values.title, values.width / 2, 18, 14, "text", "middle"),
    ],
    "nested substate region container uml statechart",
  ),
  { shape: "round", labelParam: "title" },
);

export const STATE_COMPONENTS = [
  initialState,
  finalState,
  stateBox,
  choice,
  stateFork,
  history,
  compositeState,
];
