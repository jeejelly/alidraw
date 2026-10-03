import { getPathUpdate, getCommonBounds } from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

import { getSymbolMeta, symbolGroupOf } from "./build";

/** Pins: what spans a stretched side grows, an end keeps its distance, the middle stays centred. */
export type PinX = "l" | "r" | "c" | "s" | "p";
export type PinY = "t" | "b" | "m" | "s" | "p";
export type Pin = { x: PinX; y: PinY; cover?: boolean };

export type LayoutH = "auto" | "left" | "center" | "right" | "scale";
export type LayoutV = "auto" | "top" | "middle" | "bottom" | "scale";
export type Layout = { h: LayoutH; v: LayoutV };

export type Frame = { x0: number; y0: number; x1: number; y1: number };

/** the symbol the selection is, when it is exactly one whole component */
export const getSelectedSymbol = (
  selected: readonly ExcalidrawElement[],
  all: readonly ExcalidrawElement[],
) => {
  if (!selected.length) {
    return null;
  }
  const groups = new Set(
    selected.map((element) => symbolGroupOf(element) ?? ""),
  );
  if (groups.size !== 1) {
    return null;
  }
  const [group] = [...groups];
  if (!group) {
    return null;
  }
  const members = all.filter(
    (element) => !element.isDeleted && symbolGroupOf(element) === group,
  );
  return members.length === selected.length ? { group, members } : null;
};

export const frameOf = (els: readonly ExcalidrawElement[]): Frame => {
  const [x0, y0, x1, y1] = getCommonBounds(els);
  return { x0, y0, x1, y1 };
};

export const getLayout = (members: readonly ExcalidrawElement[]): Layout => {
  const layout = members
    .map((element) => getSymbolMeta(element)?.layout)
    .find(Boolean);
  return {
    h: (layout?.h as LayoutH) ?? "auto",
    v: (layout?.v as LayoutV) ?? "auto",
  };
};

const SPAN = 0.85;

/** what each part of the component does when its frame changes */
export const inferPins = (
  members: readonly ExcalidrawElement[],
  frame: Frame,
  layout: Layout,
): Map<string, Pin> => {
  const width = frame.x1 - frame.x0 || 1;
  const height = frame.y1 - frame.y0 || 1;
  const out = new Map<string, Pin>();
  for (const el of members) {
    const growable =
      el.type === "rectangle" ||
      el.type === "path" ||
      el.type === "line" ||
      el.type === "diamond";
    const spansX = growable && el.width >= width * SPAN;
    const spansY = growable && el.height >= height * SPAN;
    // nearest end wins; only what is really in the middle is centred
    const gapL = el.x - frame.x0;
    const gapR = frame.x1 - (el.x + el.width);
    const gapT = el.y - frame.y0;
    const gapB = frame.y1 - (el.y + el.height);
    let x: PinX = spansX
      ? "s"
      : Math.abs(gapL - gapR) < width * 0.12
      ? "c"
      : gapL < gapR
      ? "l"
      : "r";
    let y: PinY = spansY
      ? "s"
      : Math.abs(gapT - gapB) < height * 0.12
      ? "m"
      : gapT < gapB
      ? "t"
      : "b";
    if (!spansX) {
      x =
        layout.h === "left"
          ? "l"
          : layout.h === "right"
          ? "r"
          : layout.h === "center"
          ? "c"
          : layout.h === "scale"
          ? "p"
          : x;
    }
    if (!spansY) {
      y =
        layout.v === "top"
          ? "t"
          : layout.v === "bottom"
          ? "b"
          : layout.v === "middle"
          ? "m"
          : layout.v === "scale"
          ? "p"
          : y;
    }
    if (layout.h === "scale") {
      x = "p";
    }
    if (layout.v === "scale") {
      y = "p";
    }
    out.set(
      el.id,
      getSymbolMeta(el)?.cover ? { x: "s", y: "s", cover: true } : { x, y },
    );
  }
  return out;
};

/** new position and size along one axis */
const along = (
  pin: PinX | PinY,
  pos: number,
  size: number,
  from: [number, number],
  to: [number, number],
): [number, number] => {
  const dL = to[0] - from[0];
  const dR = to[1] - from[1];
  switch (pin) {
    case "l":
    case "t":
      return [pos + dL, size];
    case "r":
    case "b":
      return [pos + dR, size];
    case "s":
      return [pos + dL, Math.max(1, size + dR - dL)];
    case "p": {
      const scale = (to[1] - to[0]) / (from[1] - from[0] || 1);
      return [to[0] + (pos - from[0]) * scale, Math.max(1, size * scale)];
    }
    default:
      return [pos + (dL + dR) / 2, size];
  }
};

export type Update = Record<string, any>;

/** moves and sizes one element to a box; parts that do not span keep their shape */
const boxUpdate = (
  el: ExcalidrawElement,
  pin: Pin,
  nx: number,
  ny: number,
  nw: number,
  nh: number,
): Update => {
  const resizable = el.angle === 0;
  if (el.type === "text" || !resizable) {
    return { x: nx, y: ny };
  }
  if (el.type === "path") {
    const kx = el.width ? nw / el.width : 1;
    const ky = el.height ? nh / el.height : 1;
    if (kx === 1 && ky === 1) {
      return { x: nx, y: ny };
    }
    const sc = (point: LocalPoint) =>
      pointFrom<LocalPoint>(point[0] * kx, point[1] * ky);
    const sh = (handle: ExcalidrawPathElement["handles"][number]) => ({
      ...handle,
      in: handle.in && sc(handle.in),
      out: handle.out && sc(handle.out),
    });
    const geo = getPathUpdate(el, {
      points: el.points.map(sc),
      handles: el.handles.map(sh),
      ...(el.contours
        ? {
            contours: el.contours.map((contour) => ({
              points: contour.points.map(sc),
              handles: contour.handles.map(sh),
            })),
          }
        : {}),
    });
    return { ...geo, x: nx + (geo.x - el.x), y: ny + (geo.y - el.y) };
  }
  if (el.type === "line" || el.type === "arrow") {
    const kx = el.width ? nw / el.width : 1;
    const ky = el.height ? nh / el.height : 1;
    return {
      x: nx,
      y: ny,
      width: nw,
      height: nh,
      points: (el as any).points.map(([px, py]: LocalPoint) =>
        pointFrom<LocalPoint>(px * kx, py * ky),
      ),
    };
  }
  if (
    el.type === "rectangle" ||
    el.type === "diamond" ||
    el.type === "ellipse"
  ) {
    // circles and dots keep their shape: only things that span grow
    const grows =
      pin.cover ||
      pin.x === "s" ||
      pin.y === "s" ||
      pin.x === "p" ||
      pin.y === "p";
    return grows ? { x: nx, y: ny, width: nw, height: nh } : { x: nx, y: ny };
  }
  return { x: nx, y: ny };
};

/** the changes that take the component from one frame to another */
export const stretchUpdates = (
  members: readonly ExcalidrawElement[],
  pins: ReadonlyMap<string, Pin>,
  from: Frame,
  to: Frame,
): Map<string, Update> => {
  const out = new Map<string, Update>();
  for (const el of members) {
    const pin = pins.get(el.id) ?? { x: "l" as PinX, y: "t" as PinY };
    if (pin.cover && el.angle === 0 && el.type !== "text") {
      // locked to the clipping zone: always the whole frame
      const width = to.x1 - to.x0;
      const hh = to.y1 - to.y0;
      out.set(el.id, boxUpdate(el, pin, to.x0, to.y0, width, hh));
      continue;
    }
    const [nx, nw] = along(
      pin.x,
      el.x,
      el.width,
      [from.x0, from.x1],
      [to.x0, to.x1],
    );
    const [ny, nh] = along(
      pin.y,
      el.y,
      el.height,
      [from.y0, from.y1],
      [to.y0, to.y1],
    );
    out.set(el.id, boxUpdate(el, pin, nx, ny, nw, nh));
  }
  return out;
};

export type Guide = { axis: "x" | "y"; pos: number; from: number; to: number };

/** Snaps the moving edges of a frame to nearby components and reports the guide lines. */
export const snapFrame = (
  next: Frame,
  moving: { l: boolean; r: boolean; t: boolean; b: boolean },
  others: readonly ExcalidrawElement[],
  threshold: number,
): { frame: Frame; guides: Guide[] } => {
  const frame = { ...next };
  const guides: Guide[] = [];
  const xs: { v: number; y0: number; y1: number }[] = [];
  const ys: { v: number; x0: number; x1: number }[] = [];
  for (const other of others) {
    const [x0, y0, x1, y1] = getCommonBounds([other]);
    for (const value of [x0, (x0 + x1) / 2, x1]) {
      xs.push({ v: value, y0, y1 });
    }
    for (const value of [y0, (y0 + y1) / 2, y1]) {
      ys.push({ v: value, x0, x1 });
    }
  }
  const pull = (
    edge: "x0" | "x1" | "y0" | "y1",
    list: { v: number }[],
    axis: "x" | "y",
  ) => {
    let best: any = null;
    for (const candidate of list) {
      const distance = Math.abs(candidate.v - frame[edge]);
      if (distance <= threshold && (!best || distance < best.d)) {
        best = { d: distance, c: candidate };
      }
    }
    if (best) {
      frame[edge] = best.c.v;
      guides.push({
        axis,
        pos: best.c.v,
        from:
          axis === "x"
            ? Math.min(frame.y0, best.c.y0)
            : Math.min(frame.x0, best.c.x0),
        to:
          axis === "x"
            ? Math.max(frame.y1, best.c.y1)
            : Math.max(frame.x1, best.c.x1),
      });
    }
  };
  if (moving.l) {
    pull("x0", xs, "x");
  }
  if (moving.r) {
    pull("x1", xs, "x");
  }
  if (moving.t) {
    pull("y0", ys, "y");
  }
  if (moving.b) {
    pull("y1", ys, "y");
  }
  return { frame, guides };
};
