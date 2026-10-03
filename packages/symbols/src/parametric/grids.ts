import {
  lineShape,
  defineParametric,
  rectShape,
  textShape,
  type Shape,
} from "../shapes";

import { num, pick } from "./helpers";

export const gridColumns = defineParametric(
  "grid-columns",
  "Column grid",
  "Grids",
  [
    num("columns", "Columns", 12, 1, 24),
    num("gutter", "Gutter", 16, 0, 64),
    num("margin", "Margin", 24, 0, 200),
    num("width", "Width", 720, 120, 2000),
    num("height", "Height", 400, 40, 2000),
    pick("look", "Look", "outline", ["outline", "tinted"]),
  ],
  (_t, values) => {
    const inner =
      values.width - values.margin * 2 - values.gutter * (values.columns - 1);
    const cw = Math.max(1, inner / values.columns);
    const out: Shape[] = [
      rectShape(0, 0, values.width, values.height, {
        r: 0,
        f: null,
        s: "border",
        dash: true,
      }),
    ];
    for (let index = 0; index < values.columns; index++) {
      out.push(
        rectShape(
          values.margin + index * (cw + values.gutter),
          0,
          cw,
          values.height,
          {
            r: 0,
            f: values.look === "tinted" ? "surfaceAlt" : null,
            s: "accent",
            sw: 1,
            dash: true,
          },
        ),
      );
    }
    return out;
  },
  "layout columns responsive",
);

export const gridBaseline = defineParametric(
  "grid-baseline",
  "Baseline grid",
  "Grids",
  [
    num("step", "Step", 8, 2, 100),
    num("width", "Width", 360, 40, 2000),
    num("height", "Height", 240, 40, 2000),
    num("every", "Stronger every", 4, 0, 20),
  ],
  (_t, values) => {
    const out: Shape[] = [
      rectShape(0, 0, values.width, values.height, {
        r: 0,
        f: null,
        s: "border",
        dash: true,
      }),
    ];
    for (
      let y = values.step, index = 1;
      y < values.height;
      y += values.step, index++
    ) {
      out.push(
        lineShape(
          [
            [0, y],
            [values.width, y],
          ],
          {
            s: values.every && index % values.every === 0 ? "accent" : "border",
            sw: 1,
          },
        ),
      );
    }
    return out;
  },
  "rows spacing 8pt",
);

export const gridSquare = defineParametric(
  "grid-square",
  "Square grid",
  "Grids",
  [
    num("step", "Cell", 20, 4, 200),
    num("width", "Width", 360, 40, 2000),
    num("height", "Height", 240, 40, 2000),
  ],
  (_t, values) => {
    const out: Shape[] = [
      rectShape(0, 0, values.width, values.height, {
        r: 0,
        f: null,
        s: "border",
        dash: true,
      }),
    ];
    for (let x = values.step; x < values.width; x += values.step) {
      out.push(
        lineShape(
          [
            [x, 0],
            [x, values.height],
          ],
          { s: "border", sw: 1 },
        ),
      );
    }
    for (let y = values.step; y < values.height; y += values.step) {
      out.push(
        lineShape(
          [
            [0, y],
            [values.width, y],
          ],
          { s: "border", sw: 1 },
        ),
      );
    }
    return out;
  },
  "cells checker",
);

export const gridSafe = defineParametric(
  "grid-safe-area",
  "Safe areas",
  "Grids",
  [
    num("width", "Width", 360, 200, 1000),
    num("height", "Height", 720, 300, 2000),
    num("top", "Top inset", 44, 0, 200),
    num("bottom", "Bottom inset", 34, 0, 200),
    num("side", "Side margin", 16, 0, 100),
  ],
  (_t, values) => [
    rectShape(0, 0, values.width, values.height, {
      r: 0,
      f: null,
      s: "border",
      dash: true,
    }),
    rectShape(0, 0, values.width, values.top, {
      r: 0,
      f: "surfaceAlt",
      s: null,
    }),
    rectShape(0, values.height - values.bottom, values.width, values.bottom, {
      r: 0,
      f: "surfaceAlt",
      s: null,
    }),
    rectShape(
      values.side,
      values.top,
      values.width - values.side * 2,
      values.height - values.top - values.bottom,
      {
        r: 0,
        f: null,
        s: "accent",
        dash: true,
      },
    ),
    textShape(
      "status bar",
      values.width / 2,
      values.top / 2,
      11,
      "muted",
      "middle",
    ),
    textShape(
      "home indicator",
      values.width / 2,
      values.height - values.bottom / 2,
      11,
      "muted",
      "middle",
    ),
  ],
  "phone device inset margins",
);

export const gridThirds = defineParametric(
  "grid-thirds",
  "Thirds and golden ratio",
  "Grids",
  [
    pick("kind", "Kind", "thirds", ["thirds", "golden", "halves"]),
    num("width", "Width", 480, 60, 2000),
    num("height", "Height", 300, 60, 2000),
  ],
  (_t, values) => {
    const ratio =
      values.kind === "golden" ? 0.382 : values.kind === "halves" ? 0.5 : 1 / 3;
    const xs =
      values.kind === "golden"
        ? [ratio, 1 - ratio]
        : values.kind === "halves"
        ? [ratio]
        : [ratio, 1 - ratio];
    const out: Shape[] = [
      rectShape(0, 0, values.width, values.height, {
        r: 0,
        f: null,
        s: "border",
        dash: true,
      }),
    ];
    for (const column of xs) {
      out.push(
        lineShape(
          [
            [values.width * column, 0],
            [values.width * column, values.height],
          ],
          { s: "accent", sw: 1 },
        ),
        lineShape(
          [
            [0, values.height * column],
            [values.width, values.height * column],
          ],
          { s: "accent", sw: 1 },
        ),
      );
    }
    return out;
  },
  "composition proportion",
);
