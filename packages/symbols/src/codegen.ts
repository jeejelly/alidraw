import { defaultsOf, COMPONENTS, type Values } from "./components";
import { getIcon } from "./icons";
import { parsePath } from "@excalidraw/vector";

import type { SymbolTheme } from "./theme";

/**
 * Starting code for what is on the canvas: HTML with CSS, and Jetpack Compose.
 * Each symbol becomes the component it stands for, with its label, colours and
 * width; components without a mapping come out as a commented placeholder.
 */
export type CodeItem = {
  component: string;
  values: Values;
  /** the size on the canvas, in px */
  width: number;
  height: number;
  x: number;
  y: number;
};

const html = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const kt = (s: string) =>
  `"${String(s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")}"`;
const list = (s: string) =>
  String(s)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const num = (n: number) => Math.round(n);

const ICON_KT: Record<string, string> = {
  play: "PlayArrow",
  plus: "Add",
  search: "Search",
  menu: "Menu",
  close: "Close",
  check: "Check",
  heart: "Favorite",
  star: "Star",
  settings: "Settings",
  share: "Share",
  trash: "Delete",
  pencil: "Edit",
  "more-vertical": "MoreVert",
  "arrow-left": "ArrowBack",
  user: "Person",
  bell: "Notifications",
  home: "Home",
  "folder-plus": "CreateNewFolder",
  layers: "List",
  download: "KeyboardArrowDown",
  upload: "KeyboardArrowUp",
  lock: "Lock",
  eye: "Visibility",
  calendar: "DateRange",
  clock: "Schedule",
  info: "Info",
  warning: "Warning",
  send: "Send",
  mail: "Email",
  phone: "Call",
  "chevron-down": "KeyboardArrowDown",
  "chevron-right": "KeyboardArrowRight",
  "chevron-left": "KeyboardArrowLeft",
  "check-circle": "CheckCircle",
};
const iconKt = (name: string) => `Icons.Default.${ICON_KT[name] ?? "Info"}`;

/** an icon as inline SVG, from the library's own path data */
const iconSvg = (name: string, size = 20) => {
  const def = getIcon(name);
  if (!def) {
    return "";
  }
  let d = def.d;
  try {
    d = parsePath(def.d).length ? def.d : def.d;
  } catch {
    // kept as is
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
};

type Out = { html: string; kt: string };
type Gen = (v: Values, it: CodeItem) => Out;

const rad = (theme: SymbolTheme, kind: "ctl" | "card") =>
  kind === "ctl"
    ? theme.radius >= 40
      ? 999
      : theme.radius
    : theme.radius >= 40
    ? 20
    : Math.min(28, Math.round(theme.radius * 1.5));

const GENERATORS: Record<string, (t: SymbolTheme) => Gen> = {
  button: (t) => (v, it) => {
    const look = v.look as string;
    const cls =
      look === "outline"
        ? "outlined"
        : look === "text"
        ? "text"
        : look === "tonal"
        ? "tonal"
        : look === "danger"
        ? "danger"
        : "filled";
    const icon = v.icon && v.icon !== "none" ? `${iconSvg(v.icon, 18)} ` : "";
    const comp =
      look === "outline"
        ? "OutlinedButton"
        : look === "text"
        ? "TextButton"
        : look === "tonal"
        ? "FilledTonalButton"
        : look === "elevated"
        ? "ElevatedButton"
        : "Button";
    const colors =
      look === "danger"
        ? "colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)"
        : "";
    return {
      html: `<button class="btn btn--${cls}" style="width:${num(
        it.width,
      )}px">${icon}${html(v.label)}</button>`,
      kt: `${comp}(\n    onClick = { /* TODO */ },\n    modifier = Modifier.width(${num(
        it.width,
      )}.dp),${colors ? `\n    ${colors},` : ""}\n) {${
        v.icon && v.icon !== "none"
          ? `\n    Icon(${iconKt(
              v.icon,
            )}, contentDescription = null)\n    Spacer(Modifier.width(8.dp))`
          : ""
      }\n    Text(${kt(v.label)})\n}`,
    };
  },
  "icon-button": () => (v) => ({
    html: `<button class="icon-btn icon-btn--${v.look}" aria-label="${html(
      v.icon,
    )}">${iconSvg(v.icon)}</button>`,
    kt: `${
      v.look === "filled"
        ? "FilledIconButton"
        : v.look === "soft"
        ? "FilledTonalIconButton"
        : v.look === "outline"
        ? "OutlinedIconButton"
        : "IconButton"
    }(onClick = { /* TODO */ }) {\n    Icon(${iconKt(
      v.icon,
    )}, contentDescription = ${kt(v.icon)})\n}`,
  }),
  "icon-buttons": () => (v) => ({
    html: `<div class="row">${list(v.icons)
      .map(
        (i) =>
          `<button class="icon-btn icon-btn--filled" aria-label="${html(
            i,
          )}">${iconSvg(i)}</button>`,
      )
      .join("")}</div>`,
    kt: `Row(horizontalArrangement = Arrangement.spacedBy(${num(
      v.gap,
    )}.dp)) {\n${list(v.icons)
      .map(
        (i) =>
          `    FilledIconButton(onClick = { /* TODO */ }) { Icon(${iconKt(
            i,
          )}, contentDescription = ${kt(i)}) }`,
      )
      .join("\n")}\n}`,
  }),
  fab: () => (v) => ({
    html: `<button class="fab">${iconSvg(v.icon, 24)}${
      v.label ? ` <span>${html(v.label)}</span>` : ""
    }</button>`,
    kt: v.label
      ? `ExtendedFloatingActionButton(\n    onClick = { /* TODO */ },\n    icon = { Icon(${iconKt(
          v.icon,
        )}, contentDescription = null) },\n    text = { Text(${kt(
          v.label,
        )}) },\n)`
      : `FloatingActionButton(onClick = { /* TODO */ }) {\n    Icon(${iconKt(
          v.icon,
        )}, contentDescription = ${kt(v.icon)})\n}`,
  }),
  toggle: () => (v) => ({
    html: `<label class="switch"><input type="checkbox"${
      v.on ? " checked" : ""
    }${
      v.state === "disabled" ? " disabled" : ""
    }><span class="switch__track"></span>${
      v.label ? `<span>${html(v.label)}</span>` : ""
    }</label>`,
    kt: `var checked by remember { mutableStateOf(${
      v.on
    }) }\nSwitch(checked = checked, onCheckedChange = { checked = it }${
      v.state === "disabled" ? ", enabled = false" : ""
    })`,
  }),
  checkbox: () => (v) => ({
    html: `<label class="check"><input type="checkbox"${
      v.value === "checked" ? " checked" : ""
    }${v.state === "disabled" ? " disabled" : ""}> ${html(v.label)}</label>`,
    kt: `var checked by remember { mutableStateOf(${
      v.value === "checked"
    }) }\nRow(verticalAlignment = Alignment.CenterVertically) {\n    Checkbox(checked = checked, onCheckedChange = { checked = it })\n    Text(${kt(
      v.label,
    )})\n}`,
  }),
  radio: () => (v) => ({
    html: `<label class="check"><input type="radio" name="group"${
      v.on ? " checked" : ""
    }> ${html(v.label)}</label>`,
    kt: `Row(verticalAlignment = Alignment.CenterVertically) {\n    RadioButton(selected = ${
      v.on
    }, onClick = { /* TODO */ })\n    Text(${kt(v.label)})\n}`,
  }),
  slider: () => (v, it) => ({
    html: `<input type="${
      v.range ? "range" : "range"
    }" class="slider" min="0" max="100" value="${v.value}" style="width:${num(
      it.width,
    )}px">`,
    kt: v.range
      ? `var range by remember { mutableStateOf(${v.from}f..${
          v.value
        }f) }\nRangeSlider(value = range, onValueChange = { range = it }, valueRange = 0f..100f${
          v.steps ? `, steps = ${v.steps - 1}` : ""
        }, modifier = Modifier.width(${num(it.width)}.dp))`
      : `var value by remember { mutableStateOf(${
          v.value
        }f) }\nSlider(value = value, onValueChange = { value = it }, valueRange = 0f..100f${
          v.steps ? `, steps = ${v.steps - 1}` : ""
        }, modifier = Modifier.width(${num(it.width)}.dp))`,
  }),
  input: (t) => (v, it) => ({
    html: `<label class="field" style="width:${num(it.width)}px">${
      v.label ? `<span class="field__label">${html(v.label)}</span>` : ""
    }<input class="field__input${
      v.error ? " is-error" : ""
    }" placeholder="${html(v.value || "")}">${
      v.helper ? `<span class="field__helper">${html(v.helper)}</span>` : ""
    }</label>`,
    kt: `var text by remember { mutableStateOf("") }\n${
      v.style === "filled" ? "TextField" : "OutlinedTextField"
    }(\n    value = text,\n    onValueChange = { text = it },\n    label = { Text(${kt(
      v.label || "",
    )}) },${
      v.icon && v.icon !== "none"
        ? `\n    leadingIcon = { Icon(${iconKt(
            v.icon,
          )}, contentDescription = null) },`
        : ""
    }${v.helper ? `\n    supportingText = { Text(${kt(v.helper)}) },` : ""}${
      v.error ? "\n    isError = true," : ""
    }\n    shape = RoundedCornerShape(${rad(
      t,
      "ctl",
    )}.dp),\n    modifier = Modifier.width(${num(it.width)}.dp),\n)`,
  }),
  "search-bar": () => (v, it) => ({
    html: `<div class="searchbar" style="width:${num(it.width)}px">${iconSvg(
      v.leading,
      22,
    )}<input placeholder="${html(v.placeholder)}"></div>`,
    kt: `var query by remember { mutableStateOf("") }\nSearchBar(\n    inputField = {\n        SearchBarDefaults.InputField(\n            query = query, onQueryChange = { query = it },\n            onSearch = { /* TODO */ }, expanded = false, onExpandedChange = {},\n            placeholder = { Text(${kt(
      v.placeholder,
    )}) },\n            leadingIcon = { Icon(${iconKt(
      v.leading,
    )}, contentDescription = null) },\n        )\n    },\n    expanded = false, onExpandedChange = {},\n    modifier = Modifier.width(${num(
      it.width,
    )}.dp),\n) {}`,
  }),
  select: () => (v, it) => ({
    html: `<select class="field__input" style="width:${num(it.width)}px">${list(
      v.options,
    )
      .map((o) => `<option>${html(o)}</option>`)
      .join("")}</select>`,
    kt: `var expanded by remember { mutableStateOf(false) }\nExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {\n    OutlinedTextField(value = ${kt(
      v.value,
    )}, onValueChange = {}, readOnly = true, modifier = Modifier.menuAnchor())\n    ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {\n${list(
      v.options,
    )
      .map(
        (o) =>
          `        DropdownMenuItem(text = { Text(${kt(
            o,
          )}) }, onClick = { expanded = false })`,
      )
      .join("\n")}\n    }\n}`,
  }),
  pills: () => (v) => {
    const labels = list(v.labels);
    return {
      html: `<div class="chips">${labels
        .map(
          (l, k) =>
            `<button class="chip${
              v.active === k + 1 ? " is-active" : ""
            }">${html(l)}</button>`,
        )
        .join("")}</div>`,
      kt: `Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {\n${labels
        .map(
          (l, k) =>
            `    FilterChip(selected = ${
              v.active === k + 1
            }, onClick = { /* TODO */ }, label = { Text(${kt(l)}) })`,
        )
        .join("\n")}\n}`,
    };
  },
  badge: () => (v) => ({
    html: `<span class="badge badge--${v.tone}">${html(v.text)}</span>`,
    kt: v.look === "dot" ? "Badge()" : `Badge { Text(${kt(v.text)}) }`,
  }),
  progress: () => (v, it) => ({
    html: `<progress value="${v.value}" max="100" style="width:${num(
      it.width,
    )}px"></progress>`,
    kt:
      v.style === "ring"
        ? `CircularProgressIndicator(progress = { ${(v.value / 100).toFixed(
            2,
          )}f })`
        : `LinearProgressIndicator(progress = { ${(v.value / 100).toFixed(
            2,
          )}f }, modifier = Modifier.width(${num(it.width)}.dp))`,
  }),
  snackbar: () => (v) => ({
    html: `<div class="snackbar" role="status"><span>${html(v.message)}</span>${
      v.action ? `<button>${html(v.action)}</button>` : ""
    }</div>`,
    kt: `Snackbar(action = {${
      v.action
        ? ` TextButton(onClick = { /* TODO */ }) { Text(${kt(v.action)}) } `
        : ""
    }}) { Text(${kt(v.message)}) }`,
  }),
  card: (t) => (v, it) => ({
    html: `<article class="card card--${v.look}" style="width:${num(
      it.width,
    )}px">${v.media ? '<div class="card__media"></div>' : ""}<h3>${html(
      v.title,
    )}</h3><p>${html(v.body)}</p></article>`,
    kt: `${
      v.look === "outlined"
        ? "OutlinedCard"
        : v.look === "filled"
        ? "Card"
        : "ElevatedCard"
    }(\n    shape = RoundedCornerShape(${rad(
      t,
      "card",
    )}.dp),\n    modifier = Modifier.width(${num(it.width)}.dp),\n) {\n${
      v.media
        ? "    Box(Modifier.fillMaxWidth().height(80.dp).background(MaterialTheme.colorScheme.secondaryContainer))\n"
        : ""
    }    Column(Modifier.padding(16.dp)) {\n        Text(${kt(
      v.title,
    )}, style = MaterialTheme.typography.titleMedium)\n        Text(${kt(
      v.body,
    )}, style = MaterialTheme.typography.bodySmall)\n    }\n}`,
  }),
  tabs: () => (v) => {
    const labels = list(v.labels);
    return {
      html: `<div class="tabs" role="tablist">${labels
        .map(
          (l, k) =>
            `<button role="tab" aria-selected="${v.active === k + 1}">${html(
              l,
            )}</button>`,
        )
        .join("")}</div>`,
      kt: `TabRow(selectedTabIndex = ${v.active - 1}) {\n${labels
        .map(
          (l, k) =>
            `    Tab(selected = ${
              v.active === k + 1
            }, onClick = { /* TODO */ }, text = { Text(${kt(l)}) })`,
        )
        .join("\n")}\n}`,
    };
  },
  "app-bar": () => (v, it) => ({
    html: `<header class="appbar" style="width:${num(it.width)}px">${
      v.leading !== "none"
        ? `<button class="icon-btn" aria-label="${html(v.leading)}">${iconSvg(
            v.leading,
            24,
          )}</button>`
        : ""
    }<h1>${html(v.title)}</h1></header>`,
    kt: `${
      v.size === "center"
        ? "CenterAlignedTopAppBar"
        : v.size === "medium"
        ? "MediumTopAppBar"
        : v.size === "large"
        ? "LargeTopAppBar"
        : "TopAppBar"
    }(\n    title = { Text(${kt(v.title)}) },${
      v.leading !== "none"
        ? `\n    navigationIcon = { IconButton(onClick = { /* TODO */ }) { Icon(${iconKt(
            v.leading,
          )}, contentDescription = null) } },`
        : ""
    }\n)`,
  }),
  "navigation-bar": () => (v) => {
    const items = list(v.items).map((s) => s.split(":").map((x) => x.trim()));
    return {
      html: `<nav class="navbar">${items
        .map(
          ([l, i], k) =>
            `<a${v.active === k + 1 ? ' class="is-active"' : ""}>${iconSvg(
              i ?? "home",
              24,
            )}<span>${html(l)}</span></a>`,
        )
        .join("")}</nav>`,
      kt: `NavigationBar {\n${items
        .map(
          ([l, i], k) =>
            `    NavigationBarItem(selected = ${
              v.active === k + 1
            }, onClick = { /* TODO */ }, icon = { Icon(${iconKt(
              i ?? "home",
            )}, contentDescription = null) }, label = { Text(${kt(l)}) })`,
        )
        .join("\n")}\n}`,
    };
  },
  dialog: () => (v) => ({
    html: `<dialog open class="dialog"><h2>${html(v.title)}</h2><p>${html(
      v.body,
    )}</p><div class="dialog__actions"><button>${html(
      v.cancel,
    )}</button><button class="btn btn--filled">${html(
      v.confirm,
    )}</button></div></dialog>`,
    kt: `AlertDialog(\n    onDismissRequest = { /* TODO */ },\n    title = { Text(${kt(
      v.title,
    )}) },\n    text = { Text(${kt(
      v.body,
    )}) },\n    confirmButton = { TextButton(onClick = { /* TODO */ }) { Text(${kt(
      v.confirm,
    )}) } },\n    dismissButton = { TextButton(onClick = { /* TODO */ }) { Text(${kt(
      v.cancel,
    )}) } },\n)`,
  }),
  menu: () => (v) => {
    const items = list(v.items);
    return {
      html: `<ul class="menu" role="menu">${items
        .map((i) => `<li role="menuitem">${html(i)}</li>`)
        .join("")}</ul>`,
      kt: `DropdownMenu(expanded = true, onDismissRequest = { /* TODO */ }) {\n${items
        .map(
          (i) =>
            `    DropdownMenuItem(text = { Text(${kt(
              i,
            )}) }, onClick = { /* TODO */ })`,
        )
        .join("\n")}\n}`,
    };
  },
  "segmented-buttons": () => (v) => {
    const labels = list(v.labels);
    return {
      html: `<div class="segmented" role="group">${labels
        .map(
          (l, k) =>
            `<button aria-pressed="${v.active === k + 1}">${html(l)}</button>`,
        )
        .join("")}</div>`,
      kt: `SingleChoiceSegmentedButtonRow {\n${labels
        .map(
          (l, k) =>
            `    SegmentedButton(selected = ${
              v.active === k + 1
            }, onClick = { /* TODO */ }, shape = SegmentedButtonDefaults.itemShape(index = ${k}, count = ${
              labels.length
            })) { Text(${kt(l)}) }`,
        )
        .join("\n")}\n}`,
    };
  },
  list: () => (v) => {
    const names = [
      "Chocolate milk",
      "Apple pie",
      "Tomato soup",
      "Pancakes",
      "Fruit salad",
      "Green tea",
      "Rice bowl",
      "Lemon cake",
      "Garden salad",
      "Honey toast",
    ];
    const rows = Array.from({ length: v.rows }, (_, k) => names[k % 10]);
    return {
      html: `<ul class="list">${rows
        .map(
          (r) =>
            `<li><strong>${html(r)}</strong>${
              v.lines === "two" ? "<span>Secondary text</span>" : ""
            }</li>`,
        )
        .join("")}</ul>`,
      kt: `LazyColumn {\n    items(listOf(${rows
        .map(kt)
        .join(
          ", ",
        )})) { item ->\n        ListItem(headlineContent = { Text(item) }${
        v.lines === "two"
          ? ', supportingContent = { Text("Secondary text") }'
          : ""
      })\n    }\n}`,
    };
  },
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** more components: layout aids, pickers, carousel, and the simple display parts */
const MORE: Record<string, (t: SymbolTheme) => Gen> = {
  "grid-columns": () => (v) => ({
    html: `<!-- layout grid: ${v.columns} columns, ${v.gutter}px gutter, ${
      v.margin
    }px margin -->\n<div style="display:grid;grid-template-columns:repeat(${
      v.columns
    },1fr);gap:${v.gutter}px;padding:0 ${v.margin}px;max-width:${num(
      v.width,
    )}px"></div>`,
    kt: `// layout grid: ${v.columns} columns, ${v.gutter}dp gutter, ${v.margin}dp margin\nLazyVerticalGrid(\n    columns = GridCells.Fixed(${v.columns}),\n    horizontalArrangement = Arrangement.spacedBy(${v.gutter}.dp),\n    contentPadding = PaddingValues(horizontal = ${v.margin}.dp),\n) { /* items */ }`,
  }),
  "grid-baseline": () => (v) => ({
    html: `<!-- baseline grid: ${v.step}px -->`,
    kt: `// baseline grid: ${v.step}dp (spacing in multiples of ${v.step}.dp)`,
  }),
  "grid-square": () => (v) => ({
    html: `<!-- square grid: ${v.step}px cells -->`,
    kt: `// square grid: ${v.step}dp cells`,
  }),
  "grid-safe-area": () => (v) => ({
    html: `<!-- safe areas: ${v.top}px top, ${v.bottom}px bottom, ${v.side}px sides -->\n<div style="padding:env(safe-area-inset-top, ${v.top}px) ${v.side}px env(safe-area-inset-bottom, ${v.bottom}px)"></div>`,
    kt: `// safe areas: ${v.top}dp top, ${v.bottom}dp bottom, ${v.side}dp sides\nScaffold(modifier = Modifier.safeDrawingPadding()) { padding -> /* content */ }`,
  }),
  "grid-thirds": () => (v) => ({
    html: `<!-- composition guide: ${v.kind} -->`,
    kt: `// composition guide: ${v.kind}`,
  }),
  carousel: () => (v) => ({
    html: `<div class="carousel" style="display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory">${Array.from(
      { length: v.items },
      (_, k) =>
        `<div style="flex:0 0 ${num(v.height * 1.2)}px;height:${num(
          v.height,
        )}px;scroll-snap-align:start;background:var(--surface-alt);border-radius:var(--radius-card)">Item ${
          k + 1
        }</div>`,
    ).join("")}</div>`,
    kt: `LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {\n    items(${
      v.items
    }) { index ->\n        Card(Modifier.size(width = ${num(
      v.height * 1.2,
    )}.dp, height = ${num(
      v.height,
    )}.dp)) { Text("Item \${index + 1}", Modifier.padding(12.dp)) }\n    }\n}`,
  }),
  calendar: () => (v) => ({
    html: `<input type="date" value="${v.year}-${pad2(v.month)}-${pad2(
      v.selected || 1,
    )}">`,
    kt: `val state = rememberDatePickerState()\nDatePicker(state = state)`,
  }),
  "date-picker": () => (v) => ({
    html: `<dialog open><input type="date" value="${v.year}-${pad2(
      v.month,
    )}-${pad2(
      v.day,
    )}"><div><button>Cancel</button><button>OK</button></div></dialog>`,
    kt: `val state = rememberDatePickerState()\nDatePickerDialog(\n    onDismissRequest = { /* TODO */ },\n    confirmButton = { TextButton(onClick = { /* TODO */ }) { Text("OK") } },\n    dismissButton = { TextButton(onClick = { /* TODO */ }) { Text("Cancel") } },\n) { DatePicker(state = state) }`,
  }),
  "time-picker": () => (v) => ({
    html: `<input type="time" value="${pad2(v.hour)}:${pad2(v.minute)}">`,
    kt: `val state = rememberTimePickerState(initialHour = ${
      v.hour
    }, initialMinute = ${v.minute}, is24Hour = ${!v.ampm})\n${
      v.style === "dial" ? "TimePicker" : "TimeInput"
    }(state = state)`,
  }),
  stat: () => () => ({
    html: `<article class="card" style="width:160px"><p>Listeners</p><h3>12.4k</h3></article>`,
    kt: `Card(Modifier.width(160.dp)) {\n    Column(Modifier.padding(16.dp)) {\n        Text("Listeners", style = MaterialTheme.typography.labelMedium)\n        Text("12.4k", style = MaterialTheme.typography.headlineSmall)\n    }\n}`,
  }),
  avatar: () => () => ({
    html: `<span class="badge" style="width:44px;height:44px;display:inline-grid;place-items:center;background:var(--accent)">AB</span>`,
    kt: `Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primary, modifier = Modifier.size(44.dp)) {\n    Box(contentAlignment = Alignment.Center) { Text("AB", color = MaterialTheme.colorScheme.onPrimary) }\n}`,
  }),
  divider: () => () => ({ html: "<hr>", kt: "HorizontalDivider()" }),
  tooltip: () => (v) => ({
    html: `<span role="tooltip" class="snackbar">${html(v.text)}</span>`,
    kt: `PlainTooltip { Text(${kt(v.text)}) }`,
  }),
  steps: () => (v) => {
    const labels = list(v.labels);
    return {
      html: `<ol class="steps">${labels
        .map(
          (l, k) =>
            `<li${k + 1 === v.current ? ' aria-current="step"' : ""}>${html(
              l,
            )}</li>`,
        )
        .join("")}</ol>`,
      kt: `Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {\n${labels
        .map(
          (l, k) =>
            `    Text(${kt(`${k + 1}. ${l}`)}, color = ${
              k + 1 === v.current
                ? "MaterialTheme.colorScheme.primary"
                : "MaterialTheme.colorScheme.onSurfaceVariant"
            })`,
        )
        .join("\n")}\n}`,
    };
  },
  pagination: () => (v) => ({
    html: `<nav class="row">${Array.from(
      { length: v.pages },
      (_, k) =>
        `<button class="chip${k + 1 === v.current ? " is-active" : ""}">${
          k + 1
        }</button>`,
    ).join("")}</nav>`,
    kt: `Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {\n${Array.from(
      { length: v.pages },
      (_, k) =>
        `    ${
          k + 1 === v.current ? "Button" : "OutlinedButton"
        }(onClick = { /* TODO */ }) { Text("${k + 1}") }`,
    ).join("\n")}\n}`,
  }),
  stepper: () => (v) => ({
    html: `<div class="row"><button class="icon-btn">−</button><span>${v.value}</span><button class="icon-btn">+</button></div>`,
    kt: `var count by remember { mutableStateOf(${v.value}) }\nRow(verticalAlignment = Alignment.CenterVertically) {\n    IconButton(onClick = { count-- }) { Icon(Icons.Default.Info, contentDescription = "Less") }\n    Text("$count")\n    IconButton(onClick = { count++ }) { Icon(Icons.Default.Add, contentDescription = "More") }\n}`,
  }),
  rating: () => (v) => ({
    html: `<span aria-label="${v.value} of ${v.max}">${"★".repeat(
      v.value,
    )}${"☆".repeat(Math.max(0, v.max - v.value))}</span>`,
    kt: `Row {\n    repeat(${v.max}) { index ->\n        Icon(Icons.Default.Star, contentDescription = null, tint = if (index < ${v.value}) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline)\n    }\n}`,
  }),
  table: () => (v) => {
    const cols = list(v.cols);
    return {
      html: `<table class="list" style="width:${num(
        v.width,
      )}px"><thead><tr>${cols
        .map((c) => `<th>${html(c)}</th>`)
        .join("")}</tr></thead><tbody>${Array.from(
        { length: v.rows },
        () => `<tr>${cols.map(() => "<td>…</td>").join("")}</tr>`,
      ).join("")}</tbody></table>`,
      kt: `Column {\n    Row { ${cols
        .map((c) => `Text(${kt(c)}, Modifier.weight(1f))`)
        .join("; ")} }\n    repeat(${v.rows}) { Row { ${cols
        .map(() => 'Text("…", Modifier.weight(1f))')
        .join("; ")} } }\n}`,
    };
  },
  sheet: () => (v) => {
    const items = list(v.items);
    return {
      html: `<section class="dialog"><h2>${html(
        v.title,
      )}</h2><ul class="menu">${items
        .map((i) => `<li>${html(i)}</li>`)
        .join("")}</ul></section>`,
      kt: `ModalBottomSheet(onDismissRequest = { /* TODO */ }) {\n    Text(${kt(
        v.title,
      )}, Modifier.padding(16.dp), style = MaterialTheme.typography.titleMedium)\n${items
        .map((i) => `    ListItem(headlineContent = { Text(${kt(i)}) })`)
        .join("\n")}\n}`,
    };
  },
  drawer: () => (v) => {
    const items = list(v.items).map((x) => x.split(":")[0].trim());
    return {
      html: `<nav class="menu" style="width:${num(v.width)}px"><h2>${html(
        v.title,
      )}</h2>${items.map((i) => `<a>${html(i)}</a>`).join("")}</nav>`,
      kt: `ModalDrawerSheet {\n    Text(${kt(
        v.title,
      )}, Modifier.padding(16.dp))\n${items
        .map(
          (i, k) =>
            `    NavigationDrawerItem(label = { Text(${kt(i)}) }, selected = ${
              v.active === k + 1
            }, onClick = { /* TODO */ })`,
        )
        .join("\n")}\n}`,
    };
  },
  "search-view": () => (v) => ({
    html: `<div class="searchbar"><input value="${html(v.query)}"></div>`,
    kt: `SearchBar(\n    inputField = { SearchBarDefaults.InputField(query = ${kt(
      v.query,
    )}, onQueryChange = {}, onSearch = {}, expanded = true, onExpandedChange = {}) },\n    expanded = true, onExpandedChange = {},\n) { /* ${
      v.results
    } suggestions */ }`,
  }),
  scaffold: () => (v) => ({
    html: `<!-- screen: ${html(v.title)} -->`,
    kt: `Scaffold(topBar = { TopAppBar(title = { Text(${kt(v.title)}) }) }${
      v.bottomBar ? ", bottomBar = { NavigationBar { /* items */ } }" : ""
    }${
      v.fab
        ? ", floatingActionButton = { FloatingActionButton(onClick = { /* TODO */ }) { Icon(Icons.Default.Add, contentDescription = null) } }"
        : ""
    }) { padding -> /* content */ }`,
  }),
  // frames are drawing aids, not code
  phone: () => () => ({ html: "", kt: "" }),
  browser: () => () => ({ html: "", kt: "" }),
};
Object.assign(GENERATORS, MORE);

const placeholder = (id: string, name: string): Out => ({
  html: `<!-- ${html(name)}: no HTML mapping yet -->\n<div class="todo">${html(
    name,
  )}</div>`,
  kt: `// TODO: ${name} has no Compose mapping yet\nBox(Modifier.size(48.dp))`,
});

export const cssFor = (theme: SymbolTheme) => {
  const c = theme.colors;
  const rc = rad(theme, "ctl");
  const rk = rad(theme, "card");
  return `:root {
  --page: ${c.page}; --surface: ${c.surface}; --surface-alt: ${c.surfaceAlt};
  --border: ${c.border}; --text: ${c.text}; --muted: ${c.muted};
  --accent: ${c.accent}; --on-accent: ${c.onAccent};
  --success: ${c.success}; --danger: ${c.danger};
  --radius: ${rc}px; --radius-card: ${rk}px; --stroke: ${theme.stroke}px;
}
body { margin: 0; padding: 16px; background: var(--page); color: var(--text); font-family: system-ui, sans-serif; }
.stack { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.row, .chips { display: flex; gap: 8px; }
button { font: inherit; cursor: pointer; }
.btn { height: 40px; padding: 0 20px; border-radius: var(--radius); border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.btn--filled { background: var(--accent); color: var(--on-accent); }
.btn--danger { background: var(--danger); color: var(--on-accent); }
.btn--tonal { background: var(--surface-alt); color: var(--text); }
.btn--outlined { background: transparent; color: var(--accent); border-color: var(--accent); }
.btn--text { background: transparent; color: var(--accent); }
.icon-btn { width: 40px; height: 40px; border-radius: 999px; border: 0; display: inline-grid; place-items: center; background: var(--accent); color: var(--on-accent); }
.icon-btn--soft { background: var(--surface-alt); color: var(--accent); }
.icon-btn--outline, .icon-btn--plain { background: transparent; color: var(--text); border: 1px solid var(--border); }
.fab { display: inline-flex; align-items: center; gap: 12px; min-width: 56px; height: 56px; padding: 0 16px; border: 0; border-radius: 16px; background: var(--accent); color: var(--on-accent); }
.field { display: flex; flex-direction: column; gap: 4px; }
.field__label, .field__helper { font-size: 12px; color: var(--muted); }
.field__input { height: 44px; padding: 0 12px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); color: var(--text); box-sizing: border-box; width: 100%; }
.field__input.is-error { border-color: var(--danger); }
.searchbar { display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 14px; border-radius: 999px; background: var(--surface-alt); box-sizing: border-box; }
.searchbar input { flex: 1; border: 0; background: transparent; font: inherit; color: inherit; outline: 0; }
.chip { height: 34px; padding: 0 14px; border-radius: var(--radius); border: 0; background: var(--surface-alt); color: var(--accent); }
.chip.is-active { background: var(--accent); color: var(--on-accent); }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; background: var(--success); color: var(--on-accent); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); overflow: hidden; }
.card h3, .card p { margin: 0; padding: 4px 16px; }
.card__media { height: 80px; background: var(--surface-alt); }
.tabs, .segmented { display: flex; }
.tabs button { padding: 10px 20px; background: transparent; border: 0; border-bottom: 3px solid transparent; color: var(--muted); }
.tabs [aria-selected="true"] { color: var(--accent); border-color: var(--accent); }
.segmented button { padding: 8px 16px; border: 1px solid var(--border); background: transparent; color: var(--text); }
.segmented [aria-pressed="true"] { background: var(--surface-alt); }
.appbar { display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 8px; background: var(--surface); }
.appbar h1 { font-size: 18px; margin: 0; }
.navbar { display: flex; justify-content: space-around; background: var(--surface); padding: 8px 0; }
.navbar a { display: flex; flex-direction: column; align-items: center; font-size: 11px; color: var(--muted); }
.navbar .is-active { color: var(--accent); }
.snackbar { display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; border-radius: var(--radius); background: var(--text); color: var(--page); }
.snackbar button { background: transparent; border: 0; color: var(--accent); }
.dialog { border: 1px solid var(--border); border-radius: var(--radius-card); background: var(--surface); color: var(--text); }
.dialog__actions { display: flex; justify-content: flex-end; gap: 8px; }
.menu, .list { list-style: none; margin: 0; padding: 8px 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.menu li, .list li { padding: 10px 16px; }
.list li span { display: block; font-size: 12px; color: var(--muted); }
progress { accent-color: var(--accent); }
.slider { accent-color: var(--accent); }
.switch { display: inline-flex; align-items: center; gap: 8px; }
`;
};

export const composeTheme = (theme: SymbolTheme) => {
  const c = theme.colors;
  const col = (hex: string) =>
    `Color(0xFF${hex.replace("#", "").toUpperCase()})`;
  return `val AppColors = lightColorScheme(
    primary = ${col(c.accent)},
    onPrimary = ${col(c.onAccent)},
    secondaryContainer = ${col(c.surfaceAlt)},
    surface = ${col(c.surface)},
    background = ${col(c.page)},
    onSurface = ${col(c.text)},
    onSurfaceVariant = ${col(c.muted)},
    outline = ${col(c.border)},
    error = ${col(c.danger)},
)`;
};

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
  const def = COMPONENTS.find((c) => c.id === it.component);
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
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const parts = sorted.map((it) => codeForItem(it, theme));
  const shown = parts.filter((p) => p.html || p.kt);
  const indent = (s: string, n: number) =>
    s
      .split("\n")
      .map((l) => " ".repeat(n) + l)
      .join("\n");
  return {
    html: `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${cssFor(theme)}</style>
<body>
<div class="stack">
${shown.map((p) => indent(p.html, 2)).join("\n")}
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
${shown.map((p) => indent(p.kt, 12)).join("\n")}
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
