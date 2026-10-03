import { getCornerRadius } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { codeForItem } from "../codegen";
import {
  argb,
  esc,
  indent,
  ktText,
  roundTenth,
  solid,
  svgFor,
} from "../sceneCode";

import { TOL } from "./tree";

import type { Node, Out } from "./tree";
import type { Unit } from "../sceneCode";

import type { SymbolTheme } from "../theme";

type Ctx = { fill: boolean };

const leafOut = (unit: Unit, theme: SymbolTheme, fill: boolean): Out | null => {
  if (unit.kind === "symbol") {
    const part = codeForItem(unit.item, theme);
    return part.html || part.kt ? { html: part.html, kt: part.kt } : null;
  }
  const el = unit.el;
  const width = fill ? "100%" : `${roundTenth(el.width)}px`;
  const rotate = el.angle
    ? `transform:rotate(${roundTenth((el.angle * 180) / Math.PI)}deg);`
    : "";
  const opacity = el.opacity < 100 ? `opacity:${el.opacity / 100};` : "";
  const size = `width:${width};height:${roundTenth(
    el.height,
  )}px;${rotate}${opacity}`;
  if (el.type === "text" && "text" in el) {
    const raw = el as any;
    return {
      html: `<span style="display:block;font-size:${raw.fontSize}px;color:${
        raw.strokeColor
      };white-space:pre;line-height:${raw.lineHeight}">${esc(raw.text)}</span>`,
      kt: `Text(${ktText(raw.text)}, fontSize = ${
        raw.fontSize
      }.sp, color = ${argb(
        solid(raw.strokeColor) ? raw.strokeColor : "#000000",
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
        ? roundTenth(getCornerRadius(Math.min(el.width, el.height), el))
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
      }(${fill ? "" : `${roundTenth(el.width)}.dp, `}${roundTenth(
        el.height,
      )}.dp)${
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
      kt: `Spacer(Modifier.size(${roundTenth(el.width)}.dp, ${roundTenth(
        el.height,
      )}.dp)) // TODO: ${el.type}: draw it with Canvas or a vector asset`,
    };
  }
  if (el.type === "image") {
    return {
      html: `<div style="${size}background:#eee"></div>`,
      kt: `Spacer(Modifier.size(${roundTenth(el.width)}.dp, ${roundTenth(
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
  const ok = (values: number[]) => values.every((x) => Math.abs(x) <= TOL);
  return ok(offs) ? "start" : ok(centers) ? "center" : ok(ends) ? "end" : null;
};

const renderLeaf = (
  node: Extract<Node, { t: "leaf" }>,
  ctx: Ctx,
  theme: SymbolTheme,
  skipped: Map<string, number>,
): Out => {
  const skip = (kind: string) =>
    skipped.set(kind, (skipped.get(kind) ?? 0) + 1);
  const el = node.item.u.kind === "element" ? node.item.u.el : null;
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
    leafOut(node.item.u, theme, fill && el!.type === "rectangle") ?? {
      html: "",
      kt: "",
    }
  );
};

const renderBox = (
  node: Extract<Node, { t: "box" }>,
  ctx: Ctx,
  theme: SymbolTheme,
  skipped: Map<string, number>,
): Out => {
  const el = (node.item.u as { el: ExcalidrawElement }).el;
  const rad = roundTenth(getCornerRadius(Math.min(el.width, el.height), el));
  const bw = solid(el.strokeColor) ? el.strokeWidth : 0;
  const [pl, pt, pr, pb] = node.pad.map(roundTenth);
  const inner = renderNode(node.inner, { fill: ctx.fill }, theme, skipped);
  const width = ctx.fill ? "100%" : `${roundTenth(el.width)}px`;
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
    ctx.fill ? "fillMaxWidth()" : `width(${roundTenth(el.width)}.dp)`
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
};

const renderAbs = (
  node: Extract<Node, { t: "abs" }>,
  ctx: Ctx,
  theme: SymbolTheme,
  skipped: Map<string, number>,
): Out => {
  const skip = (kind: string) =>
    skipped.set(kind, (skipped.get(kind) ?? 0) + 1);
  skip("overlapping parts (kept at their relative place in a fixed box)");
  const parts = node.kids.map((child) => ({
    k: child,
    out: renderNode(child, { fill: false }, theme, skipped),
  }));
  const html = `<div style="position:relative;width:${roundTenth(
    node.b.w,
  )}px;height:${roundTenth(node.b.h)}px">\n${parts
    .map(
      ({ k: child, out }) =>
        `  <div style="position:absolute;left:${roundTenth(
          child.b.x - node.b.x,
        )}px;top:${roundTenth(child.b.y - node.b.y)}px">\n${indent(
          out.html,
          4,
        )}\n  </div>`,
    )
    .join("\n")}\n</div>`;
  const kt = `Box(Modifier.size(${roundTenth(node.b.w)}.dp, ${roundTenth(
    node.b.h,
  )}.dp)) {\n${parts
    .map(
      ({ k: child, out }) =>
        `    Box(Modifier.offset(${roundTenth(
          child.b.x - node.b.x,
        )}.dp, ${roundTenth(child.b.y - node.b.y)}.dp)) {\n${indent(
          out.kt,
          8,
        )}\n    }`,
    )
    .join("\n")}\n}`;
  return { html, kt };
};

const renderFlow = (
  node: Extract<Node, { t: "flow" }>,
  ctx: Ctx,
  theme: SymbolTheme,
  skipped: Map<string, number>,
): Out => {
  const col = node.dir === "col";
  const cross = (child: Node) =>
    col ? child.b.x - node.b.x : child.b.y - node.b.y;
  const crossSize = (child: Node) => (col ? child.b.w : child.b.h);
  const total = col ? node.b.w : node.b.h;
  const align = alignOf(
    node.kids.map(cross),
    node.kids.map((child) => cross(child) + crossSize(child) / 2 - total / 2),
    node.kids.map((child) => cross(child) + crossSize(child) - total),
  );
  // the widest box of a flexible row takes the room the row has
  const widest = col
    ? null
    : node.kids.reduce(
        (best, child) => (child.b.w > best.b.w ? child : best),
        node.kids[0],
      );
  const flexKid =
    ctx.fill &&
    widest &&
    (widest.t === "box" ||
      (widest.t === "leaf" &&
        widest.item.u.kind === "element" &&
        widest.item.u.el.type === "rectangle")) &&
    widest.b.w >= node.b.w * 0.4
      ? widest
      : null;
  const parts = node.kids.map((child, index) => {
    const fill =
      ctx.fill && (col ? child.b.w >= node.b.w - TOL : child === flexKid);
    const out = renderNode(child, { fill }, theme, skipped);
    const own = align === null ? roundTenth(cross(child)) : 0;
    const gap = index === 0 ? 0 : roundTenth(node.gaps[index - 1]);
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
      (part) =>
        `  <div${part.wrap ? ` style="${part.wrap}"` : ""}>\n${indent(
          part.out.html,
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
    .map((part) => {
      const sp = part.gap
        ? `    Spacer(Modifier.${col ? "height" : "width"}(${part.gap}.dp))\n`
        : "";
      const offs = part.own
        ? `Modifier.padding(${col ? "start" : "top"} = ${part.own}.dp)`
        : "Modifier";
      const mod =
        !col && part.fill
          ? offs.replace("Modifier", "Modifier.weight(1f)")
          : offs;
      return `${sp}    Box(${mod}) {\n${indent(part.out.kt, 8)}\n    }`;
    })
    .join("\n")}\n}`;
  return { html, kt };
};

export const renderNode = (
  node: Node,
  ctx: Ctx,
  theme: SymbolTheme,
  skipped: Map<string, number>,
): Out => {
  switch (node.t) {
    case "leaf":
      return renderLeaf(node, ctx, theme, skipped);
    case "box":
      return renderBox(node, ctx, theme, skipped);
    case "abs":
      return renderAbs(node, ctx, theme, skipped);
    default:
      return renderFlow(node, ctx, theme, skipped);
  }
};
