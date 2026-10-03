import type { ExcalidrawElement } from "@excalidraw/element/types";

import { composeTheme, cssFor } from "../codegen";
import { boundsOfUnit, indent, unitsOf } from "../sceneCode";

import { renderNode } from "./render";
import { build } from "./tree";

import type { Item } from "./tree";

import type { SymbolTheme } from "../theme";

/**
 * The canvas as rows and columns: rectangles that hold parts become padded
 * boxes, the rest is cut at empty bands; overlaps stay in a fixed-size box.
 */
export const generateResponsiveSceneCode = (
  elements: readonly ExcalidrawElement[],
  theme: SymbolTheme,
) => {
  const units = unitsOf(elements);
  if (!units.length) {
    return null;
  }
  const order = new Map(elements.map((element, index) => [element.id, index]));
  const items: Item[] = units.map((unit) => {
    const box = boundsOfUnit(unit);
    return {
      u: unit,
      b: { x: box.x, y: box.y, w: box.w, h: box.h },
      z: unit.kind === "symbol" ? -1 : order.get(unit.el.id) ?? 0,
    };
  });
  const built = build(items)!;
  const skipped = new Map<string, number>();
  const out = renderNode(built.node, { fill: true }, theme, skipped);
  const totalWidth = Math.ceil(built.node.b.w);
  const totalHeight = Math.ceil(built.node.b.h);
  const notes = [
    `Rows and columns inferred from the canvas; widths that reach the edge stretch, the rest keep their size. ${
      built.abs
        ? `${built.abs} group(s) of overlapping parts could not be split and stay fixed.`
        : "No overlaps, everything flows."
    }`,
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
)}.page { width: 100%; max-width: ${totalWidth}px; margin: 0 auto; }
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
        Box(Modifier.widthIn(max = ${totalWidth}.dp)) {
${indent(out.kt, 12)}
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
