import { defaultsOf, defineParametric, rectShape, type Shape } from "../shapes";

import { num, bool, text, pick } from "./helpers";
import { fab } from "./buttons";
import { appBar, navBar } from "./navigation";
import { rows } from "./content";

export const scaffold = defineParametric(
  "scaffold",
  "App screen",
  "Screens",
  [
    text("title", "Title", "My app"),
    num("rows", "List rows", 5, 0, 8),
    bool("fab", "Floating button", true),
    bool("bottomBar", "Navigation bar", true),
    pick("bar", "Top bar", "small", ["small", "center", "medium", "large"]),
  ],
  (th, values) => {
    const out: Shape[] = [
      rectShape(0, 0, 360, 720, { r: 36, f: "page", s: "border", sw: 2 }),
    ];
    const bar = appBar.shapes(th, {
      ...defaultsOf(appBar),
      title: values.title,
      size: values.bar,
      actions: 2,
      width: 360,
    });
    out.push(...bar);
    const top =
      values.bar === "large" ? 160 : values.bar === "medium" ? 120 : 64;
    out.push(
      ...offset(
        rows.shapes(th, {
          ...defaultsOf(rows),
          rows: values.rows,
          width: 336,
          leading: "status",
          trailing: "actions",
          style: "cards",
        }),
        12,
        top,
      ),
    );
    if (values.bottomBar) {
      out.push(
        ...offset(
          navBar
            .shapes(th, {
              ...defaultsOf(navBar),
              items: "Home:home, Search:search, Saved:heart, Profile:user",
            })
            .map((shape) => widen(shape, 360)),
          0,
          648,
        ),
      );
    }
    if (values.fab) {
      out.push(
        ...offset(
          fab.shapes(th, { ...defaultsOf(fab), size: "regular" }),
          280,
          values.bottomBar ? 568 : 640,
        ),
      );
    }
    return out;
  },
  "phone layout mobile page",
);

const widen = (shape: Shape, width: number): Shape =>
  shape.t === "rect" && shape.x === 0 && shape.y === 0 && shape.h === 72
    ? { ...shape, w: width }
    : shape;

const offset = (shapes: Shape[], dx: number, dy: number): Shape[] =>
  shapes.map((shape) =>
    shape.t === "line"
      ? {
          ...shape,
          pts: shape.pts.map(([x, y]) => [x + dx, y + dy] as [number, number]),
        }
      : ({
          ...shape,
          x: (shape as any).x + dx,
          y: (shape as any).y + dy,
        } as Shape),
  );
