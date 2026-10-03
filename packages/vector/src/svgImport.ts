import { randomId } from "@excalidraw/common";
import {
  getPathUpdate,
  newElement,
  newLinearElement,
  newPathElement,
  newTextElement,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  PathPointHandles,
} from "@excalidraw/element/types";

import { circle, parsePath, rrect, type SubPath } from "./svgPath";

/**
 * SVG files as editable shapes: paths, rectangles, circles, lines, polygons
 * and text become path, rectangle, ellipse, line and text elements, with their
 * colours, stroke widths and transforms; one group per file.
 */
type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
const applyVec = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y,
  m[1] * x + m[3] * y,
];

const numbers = (s: string) =>
  (s.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);

export const parseTransform = (value: string | null): Matrix => {
  let m = IDENTITY;
  if (!value) {
    return m;
  }
  for (const [, name, args] of value.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const a = numbers(args);
    let t: Matrix = IDENTITY;
    switch (name) {
      case "matrix":
        if (a.length === 6) {
          t = a as Matrix;
        }
        break;
      case "translate":
        t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
        break;
      case "scale":
        t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
        break;
      case "rotate": {
        const r = ((a[0] ?? 0) * Math.PI) / 180;
        const c = Math.cos(r);
        const s = Math.sin(r);
        const rot: Matrix = [c, s, -s, c, 0, 0];
        t =
          a.length >= 3
            ? mul(mul([1, 0, 0, 1, a[1], a[2]], rot), [
                1,
                0,
                0,
                1,
                -a[1],
                -a[2],
              ])
            : rot;
        break;
      }
      case "skewX":
        t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case "skewY":
        t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = mul(m, t);
  }
  return m;
};

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  lime: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  navy: "#000080",
  teal: "#008080",
  aqua: "#00ffff",
  cyan: "#00ffff",
  fuchsia: "#ff00ff",
  magenta: "#ff00ff",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  gold: "#ffd700",
};

export const parseColor = (value: string | undefined | null): string | null => {
  if (!value) {
    return null;
  }
  const v = value.trim().toLowerCase();
  if (v === "none" || v === "transparent") {
    return "transparent";
  }
  if (v === "currentcolor") {
    return "#000000";
  }
  if (/^#[0-9a-f]{6}$/.test(v)) {
    return v;
  }
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return `#${[...v.slice(1)].map((c) => c + c).join("")}`;
  }
  const rgb = /^rgba?\(([^)]+)\)/.exec(v);
  if (rgb) {
    const parts = rgb[1].split(/[ ,/]+/).filter(Boolean);
    const ch = parts
      .slice(0, 3)
      .map((p) =>
        p.endsWith("%")
          ? Math.round((parseFloat(p) / 100) * 255)
          : Math.round(parseFloat(p)),
      );
    if (ch.length === 3 && ch.every(Number.isFinite)) {
      return `#${ch
        .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
        .join("")}`;
    }
  }
  return NAMED[v] ?? null;
};

type Style = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
};

const DEFAULT_STYLE: Style = {
  fill: "#000000",
  stroke: "transparent",
  strokeWidth: 1,
  opacity: 1,
  fontSize: 16,
};

const styleOf = (el: Element, parent: Style): Style => {
  const get = (name: string) => {
    const inline = el.getAttribute("style");
    if (inline) {
      const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(inline);
      if (m) {
        return m[1].trim();
      }
    }
    return el.getAttribute(name) ?? undefined;
  };
  const fill = parseColor(get("fill"));
  const stroke = parseColor(get("stroke"));
  const sw = parseFloat(get("stroke-width") ?? "");
  const op = parseFloat(get("opacity") ?? "");
  const fop = parseFloat(get("fill-opacity") ?? "");
  const fs = parseFloat(get("font-size") ?? "");
  return {
    fill: fill ?? parent.fill,
    stroke: stroke ?? parent.stroke,
    strokeWidth: Number.isFinite(sw) ? sw : parent.strokeWidth,
    opacity:
      parent.opacity *
      (Number.isFinite(op) ? op : 1) *
      (Number.isFinite(fop) && fill && fill !== "transparent" ? fop : 1),
    fontSize: Number.isFinite(fs) ? fs : parent.fontSize,
  };
};

const scaleOf = (m: Matrix) =>
  Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
const isAxisAligned = (m: Matrix) =>
  Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9;

const area = (s: SubPath) => {
  let a = 0;
  const p = s.anchors;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(a / 2);
};

/** sub-paths through a transform, as the geometry a path element stores */
const geometry = (subs: SubPath[], m: Matrix) =>
  subs.map((s) => {
    const pts = s.anchors.map((a) => apply(m, a.x, a.y));
    const handles: PathPointHandles[] = s.anchors.map((a) =>
      a.in || a.out
        ? {
            mode: "broken",
            in: a.in
              ? pointFrom<LocalPoint>(...applyVec(m, a.in[0], a.in[1]))
              : null,
            out: a.out
              ? pointFrom<LocalPoint>(...applyVec(m, a.out[0], a.out[1]))
              : null,
          }
        : { mode: "corner", in: null, out: null },
    );
    return { pts, handles, closed: s.closed };
  });

export type SvgImportResult = {
  elements: ExcalidrawElement[];
  skipped: string[];
};

export const importSvg = (
  text: string,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  maxSize = 1200,
): SvgImportResult => {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (
    !root ||
    root.nodeName.toLowerCase() !== "svg" ||
    doc.querySelector("parsererror")
  ) {
    throw new Error("not a valid SVG file");
  }
  const group = randomId();
  const out: ExcalidrawElement[] = [];
  const skipped = new Set<string>();

  // the viewBox decides the units: the drawing keeps its proportions
  const vb = numbers(root.getAttribute("viewBox") ?? "");
  const w = parseFloat(root.getAttribute("width") ?? "") || vb[2] || 100;
  const hgt = parseFloat(root.getAttribute("height") ?? "") || vb[3] || 100;
  const vx = vb.length === 4 ? vb[0] : 0;
  const vy = vb.length === 4 ? vb[1] : 0;
  const vw = vb.length === 4 ? vb[2] : w;
  const vh = vb.length === 4 ? vb[3] : hgt;
  let k = Math.min(w / vw, hgt / vh) || 1;
  const biggest = Math.max(vw * k, vh * k);
  if (biggest > maxSize) {
    k *= maxSize / biggest;
  }
  const base: Matrix = [k, 0, 0, k, origin.x - vx * k, origin.y - vy * k];

  const common = (st: Style, fillable = true) => ({
    strokeColor: st.stroke,
    backgroundColor: fillable ? st.fill : "transparent",
    fillStyle: "solid" as const,
    strokeWidth: Math.max(
      st.stroke === "transparent" ? 0 : 0.5,
      st.strokeWidth,
    ),
    roughness: 0,
    opacity: Math.round(Math.max(0, Math.min(1, st.opacity)) * 100),
    groupIds: [group],
  });

  const addPaths = (
    subs: SubPath[],
    m: Matrix,
    st: Style,
    closedFill: boolean,
  ) => {
    const geos = geometry(subs, m);
    if (!geos.length) {
      return;
    }
    const filled = st.fill !== "transparent";
    const opts = common(
      { ...st, strokeWidth: st.strokeWidth * scaleOf(m) },
      closedFill,
    );
    // several closed outlines that are filled: the biggest is the shape, the others holes
    const allClosed = geos.every((g) => g.closed);
    if (filled && allClosed && geos.length > 1) {
      const order = subs
        .map((s, i) => [area(s), i])
        .sort((a, b) => b[0] - a[0]);
      const main = geos[order[0][1]];
      const holes = order.slice(1).map(([, i]) => geos[i]);
      const el = newPathElement({
        ...opts,
        x: 0,
        y: 0,
        points: main.pts.map((p) => pointFrom<LocalPoint>(p[0], p[1])),
        handles: main.handles,
        closed: true,
        contours: holes.map((g) => ({
          points: g.pts.map((p) => pointFrom<LocalPoint>(p[0], p[1])),
          handles: g.handles,
        })),
      });
      out.push({
        ...el,
        ...getPathUpdate(el, {
          points: el.points,
          handles: el.handles,
          contours: el.contours,
        }),
      } as any);
      return;
    }
    for (const g of geos) {
      const el = newPathElement({
        ...opts,
        backgroundColor: g.closed ? opts.backgroundColor : "transparent",
        x: 0,
        y: 0,
        points: g.pts.map((p) => pointFrom<LocalPoint>(p[0], p[1])),
        handles: g.handles,
        closed: g.closed,
      });
      out.push({
        ...el,
        ...getPathUpdate(el, { points: el.points, handles: el.handles }),
      } as any);
    }
  };

  const walk = (node: Element, m: Matrix, parent: Style) => {
    const tag = node.localName.toLowerCase();
    if (
      [
        "defs",
        "clippath",
        "mask",
        "metadata",
        "title",
        "desc",
        "style",
        "filter",
        "symbol",
        "pattern",
      ].includes(tag)
    ) {
      if (
        tag !== "defs" &&
        tag !== "metadata" &&
        tag !== "title" &&
        tag !== "desc" &&
        tag !== "style"
      ) {
        skipped.add(tag);
      }
      return;
    }
    if (node.getAttribute("display") === "none") {
      return;
    }
    const mm = mul(m, parseTransform(node.getAttribute("transform")));
    const st = styleOf(node, parent);
    const n = (name: string, d = 0) =>
      parseFloat(node.getAttribute(name) ?? "") || d;
    switch (tag) {
      case "svg":
      case "g":
      case "a":
        for (const child of Array.from(node.children)) {
          walk(child, mm, st);
        }
        break;
      case "path":
        try {
          addPaths(parsePath(node.getAttribute("d") ?? ""), mm, st, true);
        } catch {
          skipped.add("path data");
        }
        break;
      case "rect": {
        const x = n("x");
        const y = n("y");
        const rw = n("width");
        const rh = n("height");
        const r = Math.min(n("rx", n("ry")), rw / 2, rh / 2);
        if (isAxisAligned(mm) && mm[0] > 0 && mm[3] > 0) {
          const [px, py] = apply(mm, x, y);
          const o = common({
            ...st,
            strokeWidth: st.strokeWidth * scaleOf(mm),
          });
          out.push(
            newElement({
              ...o,
              type: "rectangle",
              x: px,
              y: py,
              width: rw * mm[0],
              height: rh * mm[3],
              roundness: r > 0 ? { type: 3, value: r * mm[0] } : null,
            }) as any,
          );
        } else {
          addPaths(parsePath(rrect(x, y, rw, rh, r)), mm, st, true);
        }
        break;
      }
      case "circle":
      case "ellipse": {
        const cx = n("cx");
        const cy = n("cy");
        const rx = tag === "circle" ? n("r") : n("rx");
        const ry = tag === "circle" ? n("r") : n("ry");
        if (isAxisAligned(mm) && mm[0] > 0 && mm[3] > 0) {
          const [px, py] = apply(mm, cx - rx, cy - ry);
          out.push(
            newElement({
              ...common({ ...st, strokeWidth: st.strokeWidth * scaleOf(mm) }),
              type: "ellipse",
              x: px,
              y: py,
              width: rx * 2 * mm[0],
              height: ry * 2 * mm[3],
            }) as any,
          );
        } else {
          addPaths(parsePath(circle(cx, cy, rx)), mm, st, true);
        }
        break;
      }
      case "line": {
        const [x1, y1] = apply(mm, n("x1"), n("y1"));
        const [x2, y2] = apply(mm, n("x2"), n("y2"));
        out.push(
          newLinearElement({
            ...common(
              { ...st, strokeWidth: st.strokeWidth * scaleOf(mm) },
              false,
            ),
            strokeColor: st.stroke === "transparent" ? st.fill : st.stroke,
            type: "line",
            x: x1,
            y: y1,
            points: [
              pointFrom<LocalPoint>(0, 0),
              pointFrom<LocalPoint>(x2 - x1, y2 - y1),
            ],
          }) as any,
        );
        break;
      }
      case "polyline":
      case "polygon": {
        const a = numbers(node.getAttribute("points") ?? "");
        const pts: string[] = [];
        for (let i = 0; i + 1 < a.length; i += 2) {
          pts.push(`${i ? "L" : "M"}${a[i]} ${a[i + 1]}`);
        }
        if (pts.length) {
          addPaths(
            parsePath(pts.join("") + (tag === "polygon" ? "Z" : "")),
            mm,
            st,
            tag === "polygon",
          );
        }
        break;
      }
      case "text": {
        const content = (node.textContent ?? "").replace(/\s+/g, " ").trim();
        if (content) {
          const [px, py] = apply(mm, n("x"), n("y"));
          const size = st.fontSize * scaleOf(mm);
          const el = newTextElement({
            ...common(st),
            strokeColor: st.fill === "transparent" ? st.stroke : st.fill,
            backgroundColor: "transparent",
            text: content,
            fontSize: Math.max(6, size),
            x: px,
            y: py - size,
          });
          out.push(el as any);
        }
        break;
      }
      case "image":
      case "use":
      case "foreignobject":
        skipped.add(tag);
        break;
      default:
        break;
    }
  };

  walk(root, base, DEFAULT_STYLE);
  return { elements: out, skipped: [...skipped] };
};
