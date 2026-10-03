import { type SymbolTheme, type Token } from "../theme";
import {
  defineComponent,
  ellipseShape,
  iconShape,
  lineShape,
  rectShape,
  textShape,
  type Shape,
} from "../shapes";

export const button = (
  id: string,
  name: string,
  label: string,
  look: "primary" | "secondary" | "ghost" | "danger",
) =>
  defineComponent(id, name, "Buttons", 140, 40, () => {
    const fill: Token | null =
      look === "primary"
        ? "accent"
        : look === "danger"
        ? "danger"
        : look === "secondary"
        ? "surfaceAlt"
        : null;
    const edge: Token | null =
      look === "ghost" ? "accent" : look === "secondary" ? "border" : null;
    const ink: Token =
      look === "primary" || look === "danger"
        ? "onAccent"
        : look === "ghost"
        ? "accent"
        : "text";
    return [
      rectShape(0, 0, 140, 40, { r: "ctl", f: fill, s: edge }),
      textShape(label, 70, 20, 14, ink, "middle"),
    ];
  });

export const checkbox = (on: boolean) =>
  defineComponent(
    on ? "checkbox-on" : "checkbox-off",
    on ? "Checkbox on" : "Checkbox off",
    "Inputs",
    140,
    24,
    () => [
      rectShape(0, 2, 20, 20, {
        r: 5,
        f: on ? "accent" : "surface",
        s: on ? "accent" : "border",
      }),
      ...(on
        ? [
            lineShape(
              [
                [5, 12],
                [9, 16],
                [16, 8],
              ],
              { s: "onAccent", sw: 2 },
            ),
          ]
        : []),
      textShape("Remember me", 30, 12, 14),
    ],
  );

export const radio = (on: boolean) =>
  defineComponent(
    on ? "radio-on" : "radio-off",
    on ? "Radio on" : "Radio off",
    "Inputs",
    140,
    24,
    () => [
      ellipseShape(0, 2, 20, 20, { f: "surface", s: on ? "accent" : "border" }),
      ...(on ? [ellipseShape(5, 7, 10, 10, { f: "accent", s: null })] : []),
      textShape("Option", 30, 12, 14),
    ],
  );

export const toggle = (on: boolean) =>
  defineComponent(
    on ? "toggle-on" : "toggle-off",
    on ? "Toggle on" : "Toggle off",
    "Inputs",
    48,
    28,
    () => [
      rectShape(0, 0, 48, 28, {
        r: "pill",
        f: on ? "accent" : "surfaceAlt",
        s: on ? "accent" : "border",
      }),
      ellipseShape(on ? 24 : 4, 4, 20, 20, {
        f: on ? "onAccent" : "muted",
        s: null,
      }),
    ],
  );

export const chip = (label: string, on: boolean, width: number) => [
  rectShape(0, 0, width, 34, {
    r: "pill",
    f: on ? "accent" : "surfaceAlt",
    s: null,
  }),
  textShape(label, width / 2, 17, 13, on ? "onAccent" : "accent", "middle"),
];

export const listRow = (
  status: Token,
  title: string,
  sub: string,
  actions: string[],
  width = 340,
) => {
  const out: Shape[] = [
    rectShape(0, 0, width, 68, { r: "card", f: "surface", s: null }),
    rectShape(10, 14, 4, 40, { r: 2, f: status, s: null }),
    textShape(title, 26, 24, 14),
    textShape(sub, 26, 46, 12, "muted"),
  ];
  actions.forEach((action, index) => {
    const x =
      width -
      12 -
      40 * (actions.length - index) -
      6 * (actions.length - index - 1);
    out.push(
      rectShape(x, 14, 40, 40, { r: "pill", f: "accent", s: null }),
      iconShape(action, x + 10, 24, 20, "onAccent"),
    );
  });
  return out;
};

export const month = (theme: SymbolTheme): Shape[] => {
  const out: Shape[] = [
    rectShape(0, 0, 280, 296, { r: "card", f: "surface", s: "border" }),
    iconShape("chevron-left", 14, 14, 20, "muted"),
    textShape("September 2026", 140, 24, 15, "text", "middle"),
    iconShape("chevron-right", 246, 14, 20, "muted"),
  ];
  ["M", "T", "W", "T", "F", "S", "S"].forEach((weekday, index) =>
    out.push(textShape(weekday, 20 + index * 40, 56, 12, "muted", "middle")),
  );
  for (let cell = 0; cell < 35; cell++) {
    const day = cell - 1; // 1 September 2026 is a Tuesday
    const x = 20 + (cell % 7) * 40;
    const y = 90 + Math.floor(cell / 7) * 38;
    if (day < 1 || day > 30) {
      continue;
    }
    if (day === 17) {
      out.push(ellipseShape(x - 17, y - 17, 34, 34, { f: "accent", s: null }));
    }
    out.push(
      textShape(
        String(day),
        x,
        y,
        13,
        day === 17 ? "onAccent" : "text",
        "middle",
      ),
    );
  }
  void theme;
  return out;
};

export const field = (
  id: string,
  name: string,
  icon: string | null,
  value: string,
  ph: boolean,
  width = 280,
  right?: string,
) =>
  defineComponent(id, name, "Inputs", width, 44, () => [
    rectShape(0, 0, width, 44, { r: "ctl", f: "surface", s: "border" }),
    ...(icon ? [iconShape(icon, 12, 12, 20, "muted")] : []),
    textShape(value, icon ? 42 : 14, 22, 14, ph ? "muted" : "text"),
    ...(right ? [iconShape(right, width - 32, 12, 20, "muted")] : []),
  ]);

export function shift(shape: Shape, dx: number): Shape {
  if (shape.t === "line") {
    return {
      ...shape,
      pts: shape.pts.map(([x, y]) => [x + dx, y] as [number, number]),
    };
  }
  return { ...shape, x: (shape as any).x + dx } as Shape;
}
