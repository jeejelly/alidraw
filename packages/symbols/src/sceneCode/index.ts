import type { ExcalidrawElement } from "@excalidraw/element/types";

import { composeTheme, cssFor } from "../codegen";

import { emitUnit } from "./emit";
import { indent } from "./text";
import { boundsOfUnit, unitsOf } from "./units";

import type { Unit } from "./units";

import type { SymbolTheme } from "../theme";

export { esc, indent, ktText, roundTenth, solid, argb } from "./text";
export { pathData, svgFor } from "./svg";
export { boundsOfUnit, unitsOf } from "./units";
export type { Unit } from "./units";

/**
 * The whole drawing as a page: each symbol becomes its component, everything
 * else a positioned box, text or inline SVG. It keeps the look but is not a
 * responsive layout, and says so in the file.
 */
export const generateSceneCode = (
  elements: readonly ExcalidrawElement[],
  theme: SymbolTheme,
) => {
  const units = unitsOf(elements);
  if (!units.length) {
    return null;
  }
  const bounds = units.map(boundsOfUnit);
  const ox = Math.min(...bounds.map((box) => box.x));
  const oy = Math.min(...bounds.map((box) => box.y));
  const totalWidth = Math.ceil(
    Math.max(...bounds.map((box) => box.x + box.w)) - ox,
  );
  const totalHeight = Math.ceil(
    Math.max(...bounds.map((box) => box.y + box.h)) - oy,
  );
  const skipped = new Map<string, number>();
  const skip = (what: string) =>
    skipped.set(what, (skipped.get(what) ?? 0) + 1);

  // back to front, as drawn
  const order = new Map(elements.map((element, index) => [element.id, index]));
  const rank = (unit: Unit) =>
    unit.kind === "symbol" ? 0 : order.get(unit.el.id) ?? 0;
  const sorted = [...units].sort((first, second) => rank(first) - rank(second));

  const html: string[] = [];
  const kt: string[] = [];
  for (const unit of sorted) {
    const emitted = emitUnit(unit, { x: ox, y: oy }, theme, skip);
    if (emitted) {
      html.push(emitted.html);
      kt.push(emitted.kt);
    }
  }

  const notes = [
    "Positioned from the canvas: each part sits where it is drawn. It keeps the look but is not a responsive layout.",
    ...[...skipped].map(([kind, count]) => `${count} x ${kind}`),
  ];
  return {
    html: `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- ${notes.join("\n     ")} -->
<style>
${cssFor(
  theme,
)}.scene { position: relative; width: ${totalWidth}px; height: ${totalHeight}px; }
.scene > * { box-sizing: border-box; }
</style>
<body>
<div class="scene">
${html.map((markup) => indent(markup, 2)).join("\n")}
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
        Box(Modifier.size(${totalWidth}.dp, ${totalHeight}.dp)) {
${kt.map((code) => indent(code, 12)).join("\n")}
        }
    }
}
`,
    width: totalWidth,
    height: totalHeight,
    count: units.length,
    notes,
  };
};
