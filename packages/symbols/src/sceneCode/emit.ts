import { getCornerRadius } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { codeForItem } from "../codegen";

import { svgFor } from "./svg";
import { argb, esc, indent, ktText, roundTenth, solid } from "./text";

import { boundsOfUnit } from "./units";

import type { Unit } from "./units";

import type { SymbolTheme } from "../theme";

/** the HTML and Compose snippets for one unit of the scene */
export type Emitted = { html: string; kt: string };

type Place = { left: number; top: number };
type Skip = (what: string) => void;

const emitSymbol = (
  unit: Extract<Unit, { kind: "symbol" }>,
  place: Place,
  theme: SymbolTheme,
): Emitted | null => {
  const part = codeForItem(unit.item, theme);
  if (!part.html && !part.kt) {
    return null;
  }
  return {
    html: `<div style="position:absolute;left:${place.left}px;top:${place.top}px">${part.html}</div>`,
    kt: `Box(Modifier.offset(${place.left}.dp, ${place.top}.dp)) {\n${indent(
      part.kt,
      4,
    )}\n}`,
  };
};

const emitText = (el: ExcalidrawElement, place: Place): Emitted => {
  const raw = el as any;
  return {
    html: `<span style="position:absolute;left:${place.left}px;top:${
      place.top
    }px;font-size:${raw.fontSize}px;color:${
      raw.strokeColor
    };white-space:pre;line-height:${raw.lineHeight}">${esc(raw.text)}</span>`,
    kt: `Text(${ktText(raw.text)}, Modifier.offset(${place.left}.dp, ${
      place.top
    }.dp), fontSize = ${raw.fontSize}.sp, color = ${argb(
      solid(raw.strokeColor) ? raw.strokeColor : "#000000",
    )})`,
  };
};

const cornerRadiusOf = (el: ExcalidrawElement) =>
  roundTenth(getCornerRadius(Math.min(el.width, el.height), el));

const emitBox = (
  el: ExcalidrawElement,
  place: Place,
  pos: string,
  skip: Skip,
): Emitted => {
  const radius =
    el.type === "ellipse"
      ? "50%"
      : el.type === "rectangle"
      ? `${cornerRadiusOf(el)}px`
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
  const html = `<div style="${pos}box-sizing:border-box;${border}${
    solid(el.backgroundColor) ? `background:${el.backgroundColor};` : ""
  }border-radius:${radius};${clip}"></div>`;
  if (el.type === "diamond") {
    skip("diamond (drawn as a box in Compose)");
  }
  const shape =
    el.type === "ellipse"
      ? "CircleShape"
      : `RoundedCornerShape(${
          el.type === "rectangle" ? cornerRadiusOf(el) : 0
        }.dp)`;
  const kt = `Box(\n    Modifier\n        .offset(${place.left}.dp, ${
    place.top
  }.dp)\n        .size(${roundTenth(el.width)}.dp, ${roundTenth(
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
  },\n)`;
  return { html, kt };
};

/** lines, freedraw, paths and images: inline SVG or a placeholder */
const emitOther = (
  el: ExcalidrawElement,
  place: Place,
  pos: string,
  skip: Skip,
): Emitted | null => {
  const svg = svgFor(el);
  if (svg) {
    skip(`${el.type} (inline SVG in HTML, a TODO in Compose)`);
    return {
      html: `<div style="${pos}">${svg}</div>`,
      kt: `// TODO: ${el.type} at (${place.left}, ${place.top}), ${roundTenth(
        el.width,
      )} x ${roundTenth(el.height)}: draw it with Canvas or a vector asset`,
    };
  }
  if (el.type === "image" && (el as any).fileId) {
    skip("image");
    return {
      html: `<div style="${pos}background:#eee"><!-- image ${
        (el as any).fileId
      } --></div>`,
      kt: `// TODO: image at (${place.left}, ${place.top}), ${roundTenth(
        el.width,
      )} x ${roundTenth(el.height)}`,
    };
  }
  skip(el.type);
  return null;
};

/** the snippets for a unit placed relative to the scene origin; null when it has none */
export const emitUnit = (
  unit: Unit,
  origin: { x: number; y: number },
  theme: SymbolTheme,
  skip: Skip,
): Emitted | null => {
  const box = boundsOfUnit(unit);
  const place = {
    left: roundTenth(box.x - origin.x),
    top: roundTenth(box.y - origin.y),
  };
  if (unit.kind === "symbol") {
    return emitSymbol(unit, place, theme);
  }
  const el = unit.el;
  if (el.type === "text" && "text" in el) {
    return emitText(el, place);
  }
  const rotate = el.angle
    ? `transform:rotate(${roundTenth((el.angle * 180) / Math.PI)}deg);`
    : "";
  const opacity = el.opacity < 100 ? `opacity:${el.opacity / 100};` : "";
  const pos = `position:absolute;left:${place.left}px;top:${
    place.top
  }px;width:${roundTenth(el.width)}px;height:${roundTenth(
    el.height,
  )}px;${rotate}${opacity}`;
  if (
    el.type === "rectangle" ||
    el.type === "ellipse" ||
    el.type === "diamond"
  ) {
    return emitBox(el, place, pos, skip);
  }
  return emitOther(el, place, pos, skip);
};
