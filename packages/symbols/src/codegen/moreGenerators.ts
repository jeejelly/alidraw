import { html, kt, list, num, pad2 } from "./text";

import type { GeneratorMap } from "./types";

/** more components: layout aids, pickers, carousel, and the simple display parts */
export const MORE_GENERATORS: GeneratorMap = {
  "grid-columns": () => (values) => ({
    html: `<!-- layout grid: ${values.columns} columns, ${
      values.gutter
    }px gutter, ${
      values.margin
    }px margin -->\n<div style="display:grid;grid-template-columns:repeat(${
      values.columns
    },1fr);gap:${values.gutter}px;padding:0 ${values.margin}px;max-width:${num(
      values.width,
    )}px"></div>`,
    kt: `// layout grid: ${values.columns} columns, ${values.gutter}dp gutter, ${values.margin}dp margin\nLazyVerticalGrid(\n    columns = GridCells.Fixed(${values.columns}),\n    horizontalArrangement = Arrangement.spacedBy(${values.gutter}.dp),\n    contentPadding = PaddingValues(horizontal = ${values.margin}.dp),\n) { /* items */ }`,
  }),
  "grid-baseline": () => (values) => ({
    html: `<!-- baseline grid: ${values.step}px -->`,
    kt: `// baseline grid: ${values.step}dp (spacing in multiples of ${values.step}.dp)`,
  }),
  "grid-square": () => (values) => ({
    html: `<!-- square grid: ${values.step}px cells -->`,
    kt: `// square grid: ${values.step}dp cells`,
  }),
  "grid-safe-area": () => (values) => ({
    html: `<!-- safe areas: ${values.top}px top, ${values.bottom}px bottom, ${values.side}px sides -->\n<div style="padding:env(safe-area-inset-top, ${values.top}px) ${values.side}px env(safe-area-inset-bottom, ${values.bottom}px)"></div>`,
    kt: `// safe areas: ${values.top}dp top, ${values.bottom}dp bottom, ${values.side}dp sides\nScaffold(modifier = Modifier.safeDrawingPadding()) { padding -> /* content */ }`,
  }),
  "grid-thirds": () => (values) => ({
    html: `<!-- composition guide: ${values.kind} -->`,
    kt: `// composition guide: ${values.kind}`,
  }),
  carousel: () => (values) => ({
    html: `<div class="carousel" style="display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory">${Array.from(
      { length: values.items },
      (_, index) =>
        `<div style="flex:0 0 ${num(values.height * 1.2)}px;height:${num(
          values.height,
        )}px;scroll-snap-align:start;background:var(--surface-alt);border-radius:var(--radius-card)">Item ${
          index + 1
        }</div>`,
    ).join("")}</div>`,
    kt: `LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {\n    items(${
      values.items
    }) { index ->\n        Card(Modifier.size(width = ${num(
      values.height * 1.2,
    )}.dp, height = ${num(
      values.height,
    )}.dp)) { Text("Item \${index + 1}", Modifier.padding(12.dp)) }\n    }\n}`,
  }),
  calendar: () => (values) => ({
    html: `<input type="date" value="${values.year}-${pad2(
      values.month,
    )}-${pad2(values.selected || 1)}">`,
    kt: `val state = rememberDatePickerState()\nDatePicker(state = state)`,
  }),
  "date-picker": () => (values) => ({
    html: `<dialog open><input type="date" value="${values.year}-${pad2(
      values.month,
    )}-${pad2(
      values.day,
    )}"><div><button>Cancel</button><button>OK</button></div></dialog>`,
    kt: `val state = rememberDatePickerState()\nDatePickerDialog(\n    onDismissRequest = { /* TODO */ },\n    confirmButton = { TextButton(onClick = { /* TODO */ }) { Text("OK") } },\n    dismissButton = { TextButton(onClick = { /* TODO */ }) { Text("Cancel") } },\n) { DatePicker(state = state) }`,
  }),
  "time-picker": () => (values) => ({
    html: `<input type="time" value="${pad2(values.hour)}:${pad2(
      values.minute,
    )}">`,
    kt: `val state = rememberTimePickerState(initialHour = ${
      values.hour
    }, initialMinute = ${values.minute}, is24Hour = ${!values.ampm})\n${
      values.style === "dial" ? "TimePicker" : "TimeInput"
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
  tooltip: () => (values) => ({
    html: `<span role="tooltip" class="snackbar">${html(values.text)}</span>`,
    kt: `PlainTooltip { Text(${kt(values.text)}) }`,
  }),
  steps: () => (values) => {
    const labels = list(values.labels);
    return {
      html: `<ol class="steps">${labels
        .map(
          (label, index) =>
            `<li${
              index + 1 === values.current ? ' aria-current="step"' : ""
            }>${html(label)}</li>`,
        )
        .join("")}</ol>`,
      kt: `Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {\n${labels
        .map(
          (label, index) =>
            `    Text(${kt(`${index + 1}. ${label}`)}, color = ${
              index + 1 === values.current
                ? "MaterialTheme.colorScheme.primary"
                : "MaterialTheme.colorScheme.onSurfaceVariant"
            })`,
        )
        .join("\n")}\n}`,
    };
  },
  pagination: () => (values) => ({
    html: `<nav class="row">${Array.from(
      { length: values.pages },
      (_, index) =>
        `<button class="chip${
          index + 1 === values.current ? " is-active" : ""
        }">${index + 1}</button>`,
    ).join("")}</nav>`,
    kt: `Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {\n${Array.from(
      { length: values.pages },
      (_, index) =>
        `    ${
          index + 1 === values.current ? "Button" : "OutlinedButton"
        }(onClick = { /* TODO */ }) { Text("${index + 1}") }`,
    ).join("\n")}\n}`,
  }),
  stepper: () => (values) => ({
    html: `<div class="row"><button class="icon-btn">−</button><span>${values.value}</span><button class="icon-btn">+</button></div>`,
    kt: `var count by remember { mutableStateOf(${values.value}) }\nRow(verticalAlignment = Alignment.CenterVertically) {\n    IconButton(onClick = { count-- }) { Icon(Icons.Default.Info, contentDescription = "Less") }\n    Text("$count")\n    IconButton(onClick = { count++ }) { Icon(Icons.Default.Add, contentDescription = "More") }\n}`,
  }),
  rating: () => (values) => ({
    html: `<span aria-label="${values.value} of ${values.max}">${"★".repeat(
      values.value,
    )}${"☆".repeat(Math.max(0, values.max - values.value))}</span>`,
    kt: `Row {\n    repeat(${values.max}) { index ->\n        Icon(Icons.Default.Star, contentDescription = null, tint = if (index < ${values.value}) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline)\n    }\n}`,
  }),
  table: () => (values) => {
    const cols = list(values.cols);
    return {
      html: `<table class="list" style="width:${num(
        values.width,
      )}px"><thead><tr>${cols
        .map((color) => `<th>${html(color)}</th>`)
        .join("")}</tr></thead><tbody>${Array.from(
        { length: values.rows },
        () => `<tr>${cols.map(() => "<td>…</td>").join("")}</tr>`,
      ).join("")}</tbody></table>`,
      kt: `Column {\n    Row { ${cols
        .map((color) => `Text(${kt(color)}, Modifier.weight(1f))`)
        .join("; ")} }\n    repeat(${values.rows}) { Row { ${cols
        .map(() => 'Text("…", Modifier.weight(1f))')
        .join("; ")} } }\n}`,
    };
  },
  sheet: () => (values) => {
    const items = list(values.items);
    return {
      html: `<section class="dialog"><h2>${html(
        values.title,
      )}</h2><ul class="menu">${items
        .map((item) => `<li>${html(item)}</li>`)
        .join("")}</ul></section>`,
      kt: `ModalBottomSheet(onDismissRequest = { /* TODO */ }) {\n    Text(${kt(
        values.title,
      )}, Modifier.padding(16.dp), style = MaterialTheme.typography.titleMedium)\n${items
        .map((item) => `    ListItem(headlineContent = { Text(${kt(item)}) })`)
        .join("\n")}\n}`,
    };
  },
  drawer: () => (values) => {
    const items = list(values.items).map((x) => x.split(":")[0].trim());
    return {
      html: `<nav class="menu" style="width:${num(values.width)}px"><h2>${html(
        values.title,
      )}</h2>${items.map((item) => `<a>${html(item)}</a>`).join("")}</nav>`,
      kt: `ModalDrawerSheet {\n    Text(${kt(
        values.title,
      )}, Modifier.padding(16.dp))\n${items
        .map(
          (item, index) =>
            `    NavigationDrawerItem(label = { Text(${kt(
              item,
            )}) }, selected = ${
              values.active === index + 1
            }, onClick = { /* TODO */ })`,
        )
        .join("\n")}\n}`,
    };
  },
  "search-view": () => (values) => ({
    html: `<div class="searchbar"><input value="${html(values.query)}"></div>`,
    kt: `SearchBar(\n    inputField = { SearchBarDefaults.InputField(query = ${kt(
      values.query,
    )}, onQueryChange = {}, onSearch = {}, expanded = true, onExpandedChange = {}) },\n    expanded = true, onExpandedChange = {},\n) { /* ${
      values.results
    } suggestions */ }`,
  }),
  scaffold: () => (values) => ({
    html: `<!-- screen: ${html(values.title)} -->`,
    kt: `Scaffold(topBar = { TopAppBar(title = { Text(${kt(
      values.title,
    )}) }) }${
      values.bottomBar ? ", bottomBar = { NavigationBar { /* items */ } }" : ""
    }${
      values.fab
        ? ", floatingActionButton = { FloatingActionButton(onClick = { /* TODO */ }) { Icon(Icons.Default.Add, contentDescription = null) } }"
        : ""
    }) { padding -> /* content */ }`,
  }),
  // frames are drawing aids, not code
  phone: () => () => ({ html: "", kt: "" }),
  browser: () => () => ({ html: "", kt: "" }),
};
