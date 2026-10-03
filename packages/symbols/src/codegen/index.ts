import { COMPONENTS, defaultsOf } from "../components";

import { CORE_GENERATORS } from "./coreGenerators";
import { iconKt, iconSvg } from "./icons";
import { MORE_GENERATORS } from "./moreGenerators";
import { composeTheme, cssFor } from "./styles";
import { html, indent, kt, num } from "./text";

import type { SymbolTheme } from "../theme";
import type { CodeItem, GeneratorMap, Out } from "./types";

export type { CodeItem } from "./types";
export { composeTheme, cssFor } from "./styles";

const GENERATORS: GeneratorMap = { ...CORE_GENERATORS, ...MORE_GENERATORS };

const placeholder = (id: string, name: string): Out => ({
  html: `<!-- ${html(name)}: no HTML mapping yet -->\n<div class="todo">${html(
    name,
  )}</div>`,
  kt: `// TODO: ${name} has no Compose mapping yet\nBox(Modifier.size(48.dp))`,
});

export const codeForItem = (it: CodeItem, theme: SymbolTheme): Out => {
  if (it.component.startsWith("icon:")) {
    const name = it.component.slice(5);
    return {
      html: iconSvg(name, num(it.width)),
      kt: `Icon(${iconKt(name)}, contentDescription = ${kt(
        name,
      )}, modifier = Modifier.size(${num(it.width)}.dp))`,
    };
  }
  const def = COMPONENTS.find((component) => component.id === it.component);
  const values = { ...(def ? defaultsOf(def) : {}), ...it.values };
  const gen = GENERATORS[it.component]?.(theme);
  return gen
    ? gen(values, it)
    : placeholder(it.component, def?.name ?? it.component);
};

export const generateCode = (
  items: readonly CodeItem[],
  theme: SymbolTheme,
) => {
  const sorted = [...items].sort(
    (first, second) => first.y - second.y || first.x - second.x,
  );
  const parts = sorted.map((it) => codeForItem(it, theme));
  const shown = parts.filter((part) => part.html || part.kt);
  return {
    html: `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${cssFor(theme)}</style>
<body>
<div class="stack">
${shown.map((part) => indent(part.html, 2)).join("\n")}
</div>
</body>
</html>
`,
    compose: `import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape

${composeTheme(theme)}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Screen() {
    MaterialTheme(colorScheme = AppColors) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
${shown.map((part) => indent(part.kt, 12)).join("\n")}
        }
    }
}
`,
    count: shown.length,
    unmapped: sorted
      .filter((it) => !GENERATORS[it.component])
      .map((it) => it.component),
  };
};

export const isMapped = (component: string) => component in GENERATORS;
