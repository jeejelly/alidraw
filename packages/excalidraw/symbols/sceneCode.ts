import { getCommonBounds, getCornerRadius } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

import { getSymbolMeta, symbolGroupOf } from "./build";
import { codeForItem, composeTheme, cssFor } from "./codegen";

import type { CodeItem } from "./codegen";
import type { SymbolTheme } from "./theme";

/**
 * The whole drawing as a page: every symbol becomes its component, everything
 * else becomes a positioned box, text or inline SVG, each at the place it has
 * on the canvas. This keeps the look; it does not work out a responsive layout,
 * and says so in the file.
 */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ktText = (s: string) =>
  `"${s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/\n/g, "\\n")}"`;
const r = (n: number) => Math.round(n * 10) / 10;
const solid = (c: string) => c && c !== "transparent";
const argb = (hex: string) =>
  `Color(0xFF${hex.replace("#", "").slice(0, 6).toUpperCase()})`;
const indent = (s: string, n: number) =>
  s
    .split("\n")
    .map((l) => " ".repeat(n) + l)
    .join("\n");

const live = (e: ExcalidrawElement) => !e.isDeleted;

/** a path element as SVG path data, in its own frame */
export const pathData = (el: ExcalidrawPathElement) => {
  const loops = [
    { points: el.points, handles: el.handles, closed: el.closed },
    ...(el.contours ?? []).map((c) => ({
      points: c.points,
      handles: c.handles,
      closed: true,
    })),
  ];
  return loops
    .map((loop) => {
      const n = loop.points.length;
      if (!n) {
        return "";
      }
      const live2 = (v: readonly number[] | null | undefined) =>
        !!v && (v[0] !== 0 || v[1] !== 0);
      let d = `M${r(loop.points[0][0])} ${r(loop.points[0][1])}`;
      const last = loop.closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const a = loop.points[i];
        const b = loop.points[(i + 1) % n];
        const out = loop.handles[i]?.out;
        const inn = loop.handles[(i + 1) % n]?.in;
        if (live2(out) || live2(inn)) {
          d += `C${r(a[0] + (out?.[0] ?? 0))} ${r(a[1] + (out?.[1] ?? 0))} ${r(
            b[0] + (inn?.[0] ?? 0),
          )} ${r(b[1] + (inn?.[1] ?? 0))} ${r(b[0])} ${r(b[1])}`;
        } else {
          d += `L${r(b[0])} ${r(b[1])}`;
        }
      }
      return loop.closed ? `${d}Z` : d;
    })
    .join("");
};

const svgFor = (el: ExcalidrawElement): string | null => {
  const stroke = solid(el.strokeColor) ? el.strokeColor : "none";
  const fill = solid(el.backgroundColor) ? el.backgroundColor : "none";
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  let inner = "";
  if (el.type === "path") {
    inner = `<path d="${pathData(el)}" ${common} fill-rule="evenodd"/>`;
  } else if (el.type === "line" || el.type === "arrow") {
    inner = `<polyline points="${(el as any).points
      .map((p: number[]) => `${r(p[0])},${r(p[1])}`)
      .join(" ")}" ${common} fill="none"/>`;
  } else if (el.type === "freedraw") {
    inner = `<polyline points="${(el as any).points
      .map((p: number[]) => `${r(p[0])},${r(p[1])}`)
      .join(" ")}" ${common} fill="none"/>`;
  } else {
    return null;
  }
  return `<svg width="${r(el.width)}" height="${r(el.height)}" viewBox="0 0 ${r(
    el.width,
  )} ${r(el.height)}" style="overflow:visible">${inner}</svg>`;
};

type Unit =
  | { kind: "symbol"; item: CodeItem }
  | { kind: "element"; el: ExcalidrawElement };

const unitsOf = (elements: readonly ExcalidrawElement[]): Unit[] => {
  const all = elements.filter(live);
  const symbolGroups = new Map<string, ExcalidrawElement[]>();
  const loose: ExcalidrawElement[] = [];
  for (const el of all) {
    const g = symbolGroupOf(el);
    if (g && getSymbolMeta(el)?.component) {
      symbolGroups.set(g, [...(symbolGroups.get(g) ?? []), el]);
    } else {
      loose.push(el);
    }
  }
  const units: Unit[] = [];
  for (const members of symbolGroups.values()) {
    const m = getSymbolMeta(members[0])!;
    const [x0, y0, x1, y1] = getCommonBounds(members);
    units.push({
      kind: "symbol",
      item: {
        component: m.component!,
        values: m.values ?? {},
        width: x1 - x0,
        height: y1 - y0,
        x: x0,
        y: y0,
      },
    });
  }
  for (const el of loose) {
    units.push({ kind: "element", el });
  }
  return units;
};

const boundsOfUnit = (u: Unit) =>
  u.kind === "symbol"
    ? { x: u.item.x, y: u.item.y, w: u.item.width, h: u.item.height }
    : { x: u.el.x, y: u.el.y, w: u.el.width, h: u.el.height };

export const generateSceneCode = (
  elements: readonly ExcalidrawElement[],
  theme: SymbolTheme,
) => {
  const units = unitsOf(elements);
  if (!units.length) {
    return null;
  }
  const bounds = units.map(boundsOfUnit);
  const ox = Math.min(...bounds.map((b) => b.x));
  const oy = Math.min(...bounds.map((b) => b.y));
  const W = Math.ceil(Math.max(...bounds.map((b) => b.x + b.w)) - ox);
  const H = Math.ceil(Math.max(...bounds.map((b) => b.y + b.h)) - oy);
  const skipped = new Map<string, number>();
  const skip = (what: string) =>
    skipped.set(what, (skipped.get(what) ?? 0) + 1);

  // back to front, as drawn
  const order = new Map(elements.map((e, i) => [e.id, i]));
  const rank = (u: Unit) => (u.kind === "symbol" ? 0 : order.get(u.el.id) ?? 0);
  const sorted = [...units].sort((a, b) => rank(a) - rank(b));

  const html: string[] = [];
  const kt: string[] = [];
  for (const u of sorted) {
    const b = boundsOfUnit(u);
    const left = r(b.x - ox);
    const top = r(b.y - oy);
    if (u.kind === "symbol") {
      const part = codeForItem(u.item, theme);
      if (!part.html && !part.kt) {
        continue;
      }
      html.push(
        `<div style="position:absolute;left:${left}px;top:${top}px">${part.html}</div>`,
      );
      kt.push(
        `Box(Modifier.offset(${left}.dp, ${top}.dp)) {\n${indent(
          part.kt,
          4,
        )}\n}`,
      );
      continue;
    }
    const el = u.el;
    if (el.type === "text" && "text" in el) {
      const t = el as any;
      html.push(
        `<span style="position:absolute;left:${left}px;top:${top}px;font-size:${
          t.fontSize
        }px;color:${t.strokeColor};white-space:pre;line-height:${
          t.lineHeight
        }">${esc(t.text)}</span>`,
      );
      kt.push(
        `Text(${ktText(
          t.text,
        )}, Modifier.offset(${left}.dp, ${top}.dp), fontSize = ${
          t.fontSize
        }.sp, color = ${argb(
          solid(t.strokeColor) ? t.strokeColor : "#000000",
        )})`,
      );
      continue;
    }
    const rotate = el.angle
      ? `transform:rotate(${r((el.angle * 180) / Math.PI)}deg);`
      : "";
    const opacity = el.opacity < 100 ? `opacity:${el.opacity / 100};` : "";
    const pos = `position:absolute;left:${left}px;top:${top}px;width:${r(
      el.width,
    )}px;height:${r(el.height)}px;${rotate}${opacity}`;
    if (
      el.type === "rectangle" ||
      el.type === "ellipse" ||
      el.type === "diamond"
    ) {
      const radius =
        el.type === "ellipse"
          ? "50%"
          : el.type === "rectangle"
          ? `${r(getCornerRadius(Math.min(el.width, el.height), el))}px`
          : "0";
      const border = solid(el.strokeColor)
        ? `border:${el.strokeWidth}px ${
            el.strokeStyle === "solid" ? "solid" : el.strokeStyle
          };`
        : "";
      const clip =
        el.type === "diamond"
          ? "clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);"
          : "";
      html.push(
        `<div style="${pos}box-sizing:border-box;${border}${
          solid(el.backgroundColor) ? `background:${el.backgroundColor};` : ""
        }border-radius:${radius};${clip}"></div>`,
      );
      if (el.type === "diamond") {
        skip("diamond (drawn as a box in Compose)");
      }
      const shape =
        el.type === "ellipse"
          ? "CircleShape"
          : `RoundedCornerShape(${r(
              el.type === "rectangle"
                ? getCornerRadius(Math.min(el.width, el.height), el)
                : 0,
            )}.dp)`;
      kt.push(
        `Box(\n    Modifier\n        .offset(${left}.dp, ${top}.dp)\n        .size(${r(
          el.width,
        )}.dp, ${r(el.height)}.dp)${
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
      );
      continue;
    }
    const svg = svgFor(el);
    if (svg) {
      html.push(`<div style="${pos}">${svg}</div>`);
      kt.push(
        `// TODO: ${el.type} at (${left}, ${top}), ${r(el.width)} x ${r(
          el.height,
        )}: draw it with Canvas or a vector asset`,
      );
      skip(`${el.type} (inline SVG in HTML, a TODO in Compose)`);
      continue;
    }
    if (el.type === "image" && (el as any).fileId) {
      html.push(
        `<div style="${pos}background:#eee"><!-- image ${
          (el as any).fileId
        } --></div>`,
      );
      kt.push(
        `// TODO: image at (${left}, ${top}), ${r(el.width)} x ${r(el.height)}`,
      );
      skip("image");
      continue;
    }
    skip(el.type);
  }

  const notes = [
    "Positioned from the canvas: each part sits where it is drawn. It keeps the look but is not a responsive layout.",
    ...[...skipped].map(([k, n]) => `${n} x ${k}`),
  ];
  return {
    html: `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- ${notes.join("\n     ")} -->
<style>
${cssFor(theme)}.scene { position: relative; width: ${W}px; height: ${H}px; }
.scene > * { box-sizing: border-box; }
</style>
<body>
<div class="scene">
${html.map((h) => indent(h, 2)).join("\n")}
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
fun Scene() {
    MaterialTheme(colorScheme = AppColors) {
        Box(Modifier.size(${W}.dp, ${H}.dp)) {
${kt.map((k) => indent(k, 12)).join("\n")}
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
