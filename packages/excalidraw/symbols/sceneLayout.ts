import { getCornerRadius } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { codeForItem, composeTheme, cssFor } from "./codegen";
import {
  argb,
  boundsOfUnit,
  esc,
  indent,
  ktText,
  r,
  solid,
  svgFor,
  unitsOf,
} from "./sceneCode";

import type { Unit } from "./sceneCode";
import type { SymbolTheme } from "./theme";

/**
 * The drawing as rows and columns. Rectangles that hold other parts become
 * padded boxes; what remains is cut where it has empty bands, top to bottom
 * (a column) or left to right (a row), recursively. Parts that overlap and
 * cannot be cut are kept at their relative place in a fixed-size box.
 * The widths that reach the edge of a flexible parent stretch with it.
 */
type Box = { x: number; y: number; w: number; h: number };
type Item = { u: Unit; b: Box; z: number };

type Node =
  | { t: "leaf"; item: Item; b: Box }
  | {
      t: "box";
      item: Item;
      b: Box;
      inner: Node;
      pad: [number, number, number, number];
    }
  | { t: "flow"; dir: "col" | "row"; kids: Node[]; gaps: number[]; b: Box }
  | { t: "abs"; kids: Node[]; b: Box };

type Out = { html: string; kt: string };

const TOL = 1;

const union = (bs: Box[]): Box => {
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...bs.map((b) => b.x + b.w)) - x,
    h: Math.max(...bs.map((b) => b.y + b.h)) - y,
  };
};

const contains = (a: Box, b: Box) =>
  b.x >= a.x - TOL &&
  b.y >= a.y - TOL &&
  b.x + b.w <= a.x + a.w + TOL &&
  b.y + b.h <= a.y + a.h + TOL;

const isRect = (i: Item) =>
  i.u.kind === "element" && i.u.el.type === "rectangle";

/** sibling groups separated by an empty band on one axis */
const split = (nodes: Node[], axis: "x" | "y"): Node[][] => {
  const lo = (n: Node) => (axis === "x" ? n.b.x : n.b.y);
  const hi = (n: Node) => (axis === "x" ? n.b.x + n.b.w : n.b.y + n.b.h);
  const sorted = [...nodes].sort((a, b) => lo(a) - lo(b));
  const groups: Node[][] = [];
  let reach = -Infinity;
  for (const n of sorted) {
    if (groups.length && lo(n) >= reach - 0.01) {
      groups.push([n]);
    } else if (groups.length) {
      groups[groups.length - 1].push(n);
    } else {
      groups.push([n]);
    }
    reach = Math.max(reach, hi(n));
  }
  return groups;
};

const layout = (nodes: Node[]): Node => {
  if (nodes.length === 1) {
    return nodes[0];
  }
  for (const [axis, dir] of [
    ["y", "col"],
    ["x", "row"],
  ] as const) {
    const groups = split(nodes, axis);
    if (groups.length > 1) {
      const kids = groups.map(layout);
      const gaps = kids
        .slice(1)
        .map((k, i) =>
          axis === "y"
            ? k.b.y - (kids[i].b.y + kids[i].b.h)
            : k.b.x - (kids[i].b.x + kids[i].b.w),
        );
      return { t: "flow", dir, kids, gaps, b: union(kids.map((k) => k.b)) };
    }
  }
  const kids = [...nodes].sort(
    (a, b) => (a.t === "abs" ? 0 : zOf(a)) - (b.t === "abs" ? 0 : zOf(b)),
  );
  return { t: "abs", kids, b: union(nodes.map((n) => n.b)) };
};

const zOf = (n: Node): number =>
  n.t === "leaf" || n.t === "box" ? n.item.z : 0;

/** containers first: each part goes into the smallest rectangle around it */
const build = (items: Item[]): { node: Node; abs: number } | null => {
  if (!items.length) {
    return null;
  }
  const area = (i: Item) => i.b.w * i.b.h;
  const parentOf = new Map<Item, Item>();
  for (const it of items) {
    let best: Item | null = null;
    for (const c of items) {
      if (
        c !== it &&
        isRect(c) &&
        area(c) > area(it) &&
        contains(c.b, it.b) &&
        (!best || area(c) < area(best))
      ) {
        best = c;
      }
    }
    if (best) {
      parentOf.set(it, best);
    }
  }
  let abs = 0;
  const make = (it: Item): Node => {
    const kids = items.filter((k) => parentOf.get(k) === it);
    if (!kids.length) {
      return { t: "leaf", item: it, b: it.b };
    }
    const inner = layoutOf(kids.map(make));
    const ib = inner.b;
    return {
      t: "box",
      item: it,
      b: it.b,
      inner,
      pad: [
        Math.max(0, ib.x - it.b.x),
        Math.max(0, ib.y - it.b.y),
        Math.max(0, it.b.x + it.b.w - (ib.x + ib.w)),
        Math.max(0, it.b.y + it.b.h - (ib.y + ib.h)),
      ],
    };
  };
  const layoutOf = (nodes: Node[]) => {
    const n = layout(nodes);
    countAbs(n);
    return n;
  };
  const counted = new Set<Node>();
  const countAbs = (n: Node) => {
    if (n.t === "abs" && !counted.has(n)) {
      counted.add(n);
      abs++;
    }
  };
  const top = items.filter((i) => !parentOf.has(i)).map(make);
  return { node: layoutOf(top), abs };
};

type Ctx = { fill: boolean };

const leafOut = (u: Unit, theme: SymbolTheme, fill: boolean): Out | null => {
  if (u.kind === "symbol") {
    const part = codeForItem(u.item, theme);
    return part.html || part.kt ? { html: part.html, kt: part.kt } : null;
  }
  const el = u.el;
  const w = fill ? "100%" : `${r(el.width)}px`;
  const rotate = el.angle
    ? `transform:rotate(${r((el.angle * 180) / Math.PI)}deg);`
    : "";
  const opacity = el.opacity < 100 ? `opacity:${el.opacity / 100};` : "";
  const size = `width:${w};height:${r(el.height)}px;${rotate}${opacity}`;
  if (el.type === "text" && "text" in el) {
    const t = el as any;
    return {
      html: `<span style="display:block;font-size:${t.fontSize}px;color:${
        t.strokeColor
      };white-space:pre;line-height:${t.lineHeight}">${esc(t.text)}</span>`,
      kt: `Text(${ktText(t.text)}, fontSize = ${t.fontSize}.sp, color = ${argb(
        solid(t.strokeColor) ? t.strokeColor : "#000000",
      )})`,
    };
  }
  if (
    el.type === "rectangle" ||
    el.type === "ellipse" ||
    el.type === "diamond"
  ) {
    const rad =
      el.type === "rectangle"
        ? r(getCornerRadius(Math.min(el.width, el.height), el))
        : 0;
    const radius = el.type === "ellipse" ? "50%" : `${rad}px`;
    const border = solid(el.strokeColor)
      ? `border:${el.strokeWidth}px ${el.strokeStyle} ${el.strokeColor};`
      : "";
    const clip =
      el.type === "diamond"
        ? "clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);"
        : "";
    const shape =
      el.type === "ellipse" ? "CircleShape" : `RoundedCornerShape(${rad}.dp)`;
    return {
      html: `<div style="${size}box-sizing:border-box;${border}${
        solid(el.backgroundColor) ? `background:${el.backgroundColor};` : ""
      }border-radius:${radius};${clip}"></div>`,
      kt: `Box(\n    Modifier\n        .${
        fill ? "fillMaxWidth().height" : "size"
      }(${fill ? "" : `${r(el.width)}.dp, `}${r(el.height)}.dp)${
        solid(el.backgroundColor)
          ? `\n        .background(${argb(el.backgroundColor)}, ${shape})`
          : ""
      }${
        solid(el.strokeColor)
          ? `\n        .border(${el.strokeWidth}.dp, ${argb(
              el.strokeColor,
            )}, ${shape})`
          : ""
      },\n)`,
    };
  }
  const svg = svgFor(el);
  if (svg) {
    return {
      html: `<div style="${size}">${svg}</div>`,
      kt: `Spacer(Modifier.size(${r(el.width)}.dp, ${r(
        el.height,
      )}.dp)) // TODO: ${el.type}: draw it with Canvas or a vector asset`,
    };
  }
  if (el.type === "image") {
    return {
      html: `<div style="${size}background:#eee"></div>`,
      kt: `Spacer(Modifier.size(${r(el.width)}.dp, ${r(
        el.height,
      )}.dp)) // TODO: image`,
    };
  }
  return null;
};

const alignOf = (
  offs: number[],
  centers: number[],
  ends: number[],
): "start" | "center" | "end" | null => {
  const ok = (v: number[]) => v.every((x) => Math.abs(x) <= TOL);
  return ok(offs) ? "start" : ok(centers) ? "center" : ok(ends) ? "end" : null;
};

const render = (
  n: Node,
  ctx: Ctx,
  theme: SymbolTheme,
  skipped: Map<string, number>,
): Out => {
  const skip = (k: string) => skipped.set(k, (skipped.get(k) ?? 0) + 1);
  if (n.t === "leaf") {
    const el = n.item.u.kind === "element" ? n.item.u.el : null;
    if (el && (el.type === "diamond" || svgFor(el))) {
      skip(
        el.type === "diamond"
          ? "diamond (a box in Compose)"
          : `${el.type} (inline SVG in HTML, a placeholder in Compose)`,
      );
    }
    const fill =
      ctx.fill && !!el && (el.type === "rectangle" || el.type === "ellipse");
    return (
      leafOut(n.item.u, theme, fill && el!.type === "rectangle") ?? {
        html: "",
        kt: "",
      }
    );
  }
  if (n.t === "box") {
    const el = (n.item.u as { el: ExcalidrawElement }).el;
    const rad = r(getCornerRadius(Math.min(el.width, el.height), el));
    const bw = solid(el.strokeColor) ? el.strokeWidth : 0;
    const [pl, pt, pr, pb] = n.pad.map(r);
    const inner = render(n.inner, { fill: ctx.fill }, theme, skipped);
    const width = ctx.fill ? "100%" : `${r(el.width)}px`;
    const html = `<div style="box-sizing:border-box;width:${width};padding:${Math.max(
      0,
      pt - bw,
    )}px ${Math.max(0, pr - bw)}px ${Math.max(0, pb - bw)}px ${Math.max(
      0,
      pl - bw,
    )}px;${bw ? `border:${bw}px ${el.strokeStyle} ${el.strokeColor};` : ""}${
      solid(el.backgroundColor) ? `background:${el.backgroundColor};` : ""
    }border-radius:${rad}px">\n${indent(inner.html, 2)}\n</div>`;
    const shape = `RoundedCornerShape(${rad}.dp)`;
    const kt = `Column(\n    Modifier\n        .${
      ctx.fill ? "fillMaxWidth()" : `width(${r(el.width)}.dp)`
    }${
      solid(el.backgroundColor)
        ? `\n        .background(${argb(el.backgroundColor)}, ${shape})`
        : ""
    }${
      bw ? `\n        .border(${bw}.dp, ${argb(el.strokeColor)}, ${shape})` : ""
    }\n        .padding(start = ${pl}.dp, top = ${pt}.dp, end = ${pr}.dp, bottom = ${pb}.dp),\n) {\n${indent(
      inner.kt,
      4,
    )}\n}`;
    return { html, kt };
  }
  if (n.t === "abs") {
    skip("overlapping parts (kept at their relative place in a fixed box)");
    const parts = n.kids.map((k) => ({
      k,
      out: render(k, { fill: false }, theme, skipped),
    }));
    const html = `<div style="position:relative;width:${r(n.b.w)}px;height:${r(
      n.b.h,
    )}px">\n${parts
      .map(
        ({ k, out }) =>
          `  <div style="position:absolute;left:${r(k.b.x - n.b.x)}px;top:${r(
            k.b.y - n.b.y,
          )}px">\n${indent(out.html, 4)}\n  </div>`,
      )
      .join("\n")}\n</div>`;
    const kt = `Box(Modifier.size(${r(n.b.w)}.dp, ${r(n.b.h)}.dp)) {\n${parts
      .map(
        ({ k, out }) =>
          `    Box(Modifier.offset(${r(k.b.x - n.b.x)}.dp, ${r(
            k.b.y - n.b.y,
          )}.dp)) {\n${indent(out.kt, 8)}\n    }`,
      )
      .join("\n")}\n}`;
    return { html, kt };
  }

  // flow
  const col = n.dir === "col";
  const cross = (k: Node) => (col ? k.b.x - n.b.x : k.b.y - n.b.y);
  const crossSize = (k: Node) => (col ? k.b.w : k.b.h);
  const total = col ? n.b.w : n.b.h;
  const align = alignOf(
    n.kids.map(cross),
    n.kids.map((k) => cross(k) + crossSize(k) / 2 - total / 2),
    n.kids.map((k) => cross(k) + crossSize(k) - total),
  );
  // the widest box of a flexible row takes the room the row has
  const widest = col
    ? null
    : n.kids.reduce((a, k) => (k.b.w > a.b.w ? k : a), n.kids[0]);
  const flexKid =
    ctx.fill &&
    widest &&
    (widest.t === "box" ||
      (widest.t === "leaf" &&
        widest.item.u.kind === "element" &&
        widest.item.u.el.type === "rectangle")) &&
    widest.b.w >= n.b.w * 0.4
      ? widest
      : null;
  const parts = n.kids.map((k, i) => {
    const fill = ctx.fill && (col ? k.b.w >= n.b.w - TOL : k === flexKid);
    const out = render(k, { fill }, theme, skipped);
    const own = align === null ? r(cross(k)) : 0;
    const gap = i === 0 ? 0 : r(n.gaps[i - 1]);
    let wrap = col
      ? `${gap ? `margin-top:${gap}px;` : ""}${
          own ? `margin-left:${own}px;` : ""
        }`
      : `${gap ? `margin-left:${gap}px;` : ""}${
          own ? `margin-top:${own}px;` : ""
        }`;
    if (fill) {
      wrap += col ? "width:100%;" : "flex:1;min-width:0;";
    }
    return { out, wrap, own, gap, fill };
  });
  const aj =
    align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start";
  const html = `<div style="display:flex;flex-direction:${
    col ? "column" : "row"
  };align-items:${aj};${ctx.fill ? "width:100%;" : ""}">\n${parts
    .map(
      (p) =>
        `  <div${p.wrap ? ` style="${p.wrap}"` : ""}>\n${indent(
          p.out.html,
          4,
        )}\n  </div>`,
    )
    .join("\n")}\n</div>`;
  const ka =
    align === "center"
      ? col
        ? "Alignment.CenterHorizontally"
        : "Alignment.CenterVertically"
      : align === "end"
      ? col
        ? "Alignment.End"
        : "Alignment.Bottom"
      : col
      ? "Alignment.Start"
      : "Alignment.Top";
  const kt = `${col ? "Column" : "Row"}(\n    ${
    ctx.fill && col ? "Modifier.fillMaxWidth(),\n    " : ""
  }${ctx.fill && !col ? "Modifier.fillMaxWidth(),\n    " : ""}${
    col ? "horizontalAlignment" : "verticalAlignment"
  } = ${ka},\n) {\n${parts
    .map((p) => {
      const sp = p.gap
        ? `    Spacer(Modifier.${col ? "height" : "width"}(${p.gap}.dp))\n`
        : "";
      const offs = p.own
        ? `Modifier.padding(${col ? "start" : "top"} = ${p.own}.dp)`
        : "Modifier";
      const mod =
        !col && p.fill ? offs.replace("Modifier", "Modifier.weight(1f)") : offs;
      return `${sp}    Box(${mod}) {\n${indent(p.out.kt, 8)}\n    }`;
    })
    .join("\n")}\n}`;
  return { html, kt };
};

/** whole canvas as a layout of rows, columns and padded boxes */
export const generateResponsiveSceneCode = (
  elements: readonly ExcalidrawElement[],
  theme: SymbolTheme,
) => {
  const units = unitsOf(elements);
  if (!units.length) {
    return null;
  }
  const order = new Map(elements.map((e, i) => [e.id, i]));
  const items: Item[] = units.map((u) => {
    const b = boundsOfUnit(u);
    return {
      u,
      b: { x: b.x, y: b.y, w: b.w, h: b.h },
      z: u.kind === "symbol" ? -1 : order.get(u.el.id) ?? 0,
    };
  });
  const built = build(items)!;
  const skipped = new Map<string, number>();
  const out = render(built.node, { fill: true }, theme, skipped);
  const W = Math.ceil(built.node.b.w);
  const H = Math.ceil(built.node.b.h);
  const notes = [
    `Rows and columns inferred from the canvas; widths that reach the edge stretch, the rest keep their size. ${
      built.abs
        ? `${built.abs} group(s) of overlapping parts could not be split and stay fixed.`
        : "No overlaps, everything flows."
    }`,
    ...[...skipped].map(([k, n]) => `${n} x ${k}`),
  ];
  return {
    html: `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- ${notes.join("\n     ")} -->
<style>
${cssFor(theme)}.page { width: 100%; max-width: ${W}px; margin: 0 auto; }
.page * { box-sizing: border-box; }
</style>
<body>
<div class="page">
${indent(out.html, 2)}
</div>
</body>
</html>
`,
    compose: `import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ${notes.join("\n// ")}

${composeTheme(theme)}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Screen() {
    MaterialTheme(colorScheme = AppColors) {
        Box(Modifier.widthIn(max = ${W}.dp)) {
${indent(out.kt, 12)}
        }
    }
}
`,
    width: W,
    height: H,
    count: units.length,
    notes,
  };
};
