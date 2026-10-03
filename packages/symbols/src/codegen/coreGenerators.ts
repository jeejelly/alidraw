import { html, kt, list, num } from "./text";
import { rad } from "./styles";
import { iconKt, iconSvg } from "./icons";

import type { GeneratorMap } from "./types";

export const CORE_GENERATORS: GeneratorMap = {
  button: (theme) => (values, it) => {
    const look = values.look as string;
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
    const icon =
      values.icon && values.icon !== "none"
        ? `${iconSvg(values.icon, 18)} `
        : "";
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
      )}px">${icon}${html(values.label)}</button>`,
      kt: `${comp}(\n    onClick = { /* TODO */ },\n    modifier = Modifier.width(${num(
        it.width,
      )}.dp),${colors ? `\n    ${colors},` : ""}\n) {${
        values.icon && values.icon !== "none"
          ? `\n    Icon(${iconKt(
              values.icon,
            )}, contentDescription = null)\n    Spacer(Modifier.width(8.dp))`
          : ""
      }\n    Text(${kt(values.label)})\n}`,
    };
  },
  "icon-button": () => (values) => ({
    html: `<button class="icon-btn icon-btn--${values.look}" aria-label="${html(
      values.icon,
    )}">${iconSvg(values.icon)}</button>`,
    kt: `${
      values.look === "filled"
        ? "FilledIconButton"
        : values.look === "soft"
        ? "FilledTonalIconButton"
        : values.look === "outline"
        ? "OutlinedIconButton"
        : "IconButton"
    }(onClick = { /* TODO */ }) {\n    Icon(${iconKt(
      values.icon,
    )}, contentDescription = ${kt(values.icon)})\n}`,
  }),
  "icon-buttons": () => (values) => ({
    html: `<div class="row">${list(values.icons)
      .map(
        (item) =>
          `<button class="icon-btn icon-btn--filled" aria-label="${html(
            item,
          )}">${iconSvg(item)}</button>`,
      )
      .join("")}</div>`,
    kt: `Row(horizontalArrangement = Arrangement.spacedBy(${num(
      values.gap,
    )}.dp)) {\n${list(values.icons)
      .map(
        (item) =>
          `    FilledIconButton(onClick = { /* TODO */ }) { Icon(${iconKt(
            item,
          )}, contentDescription = ${kt(item)}) }`,
      )
      .join("\n")}\n}`,
  }),
  fab: () => (values) => ({
    html: `<button class="fab">${iconSvg(values.icon, 24)}${
      values.label ? ` <span>${html(values.label)}</span>` : ""
    }</button>`,
    kt: values.label
      ? `ExtendedFloatingActionButton(\n    onClick = { /* TODO */ },\n    icon = { Icon(${iconKt(
          values.icon,
        )}, contentDescription = null) },\n    text = { Text(${kt(
          values.label,
        )}) },\n)`
      : `FloatingActionButton(onClick = { /* TODO */ }) {\n    Icon(${iconKt(
          values.icon,
        )}, contentDescription = ${kt(values.icon)})\n}`,
  }),
  toggle: () => (values) => ({
    html: `<label class="switch"><input type="checkbox"${
      values.on ? " checked" : ""
    }${
      values.state === "disabled" ? " disabled" : ""
    }><span class="switch__track"></span>${
      values.label ? `<span>${html(values.label)}</span>` : ""
    }</label>`,
    kt: `var checked by remember { mutableStateOf(${
      values.on
    }) }\nSwitch(checked = checked, onCheckedChange = { checked = it }${
      values.state === "disabled" ? ", enabled = false" : ""
    })`,
  }),
  checkbox: () => (values) => ({
    html: `<label class="check"><input type="checkbox"${
      values.value === "checked" ? " checked" : ""
    }${values.state === "disabled" ? " disabled" : ""}> ${html(
      values.label,
    )}</label>`,
    kt: `var checked by remember { mutableStateOf(${
      values.value === "checked"
    }) }\nRow(verticalAlignment = Alignment.CenterVertically) {\n    Checkbox(checked = checked, onCheckedChange = { checked = it })\n    Text(${kt(
      values.label,
    )})\n}`,
  }),
  radio: () => (values) => ({
    html: `<label class="check"><input type="radio" name="group"${
      values.on ? " checked" : ""
    }> ${html(values.label)}</label>`,
    kt: `Row(verticalAlignment = Alignment.CenterVertically) {\n    RadioButton(selected = ${
      values.on
    }, onClick = { /* TODO */ })\n    Text(${kt(values.label)})\n}`,
  }),
  slider: () => (values, it) => ({
    html: `<input type="${
      values.range ? "range" : "range"
    }" class="slider" min="0" max="100" value="${
      values.value
    }" style="width:${num(it.width)}px">`,
    kt: values.range
      ? `var range by remember { mutableStateOf(${values.from}f..${
          values.value
        }f) }\nRangeSlider(value = range, onValueChange = { range = it }, valueRange = 0f..100f${
          values.steps ? `, steps = ${values.steps - 1}` : ""
        }, modifier = Modifier.width(${num(it.width)}.dp))`
      : `var value by remember { mutableStateOf(${
          values.value
        }f) }\nSlider(value = value, onValueChange = { value = it }, valueRange = 0f..100f${
          values.steps ? `, steps = ${values.steps - 1}` : ""
        }, modifier = Modifier.width(${num(it.width)}.dp))`,
  }),
  input: (theme) => (values, it) => ({
    html: `<label class="field" style="width:${num(it.width)}px">${
      values.label
        ? `<span class="field__label">${html(values.label)}</span>`
        : ""
    }<input class="field__input${
      values.error ? " is-error" : ""
    }" placeholder="${html(values.value || "")}">${
      values.helper
        ? `<span class="field__helper">${html(values.helper)}</span>`
        : ""
    }</label>`,
    kt: `var text by remember { mutableStateOf("") }\n${
      values.style === "filled" ? "TextField" : "OutlinedTextField"
    }(\n    value = text,\n    onValueChange = { text = it },\n    label = { Text(${kt(
      values.label || "",
    )}) },${
      values.icon && values.icon !== "none"
        ? `\n    leadingIcon = { Icon(${iconKt(
            values.icon,
          )}, contentDescription = null) },`
        : ""
    }${
      values.helper
        ? `\n    supportingText = { Text(${kt(values.helper)}) },`
        : ""
    }${
      values.error ? "\n    isError = true," : ""
    }\n    shape = RoundedCornerShape(${rad(
      theme,
      "ctl",
    )}.dp),\n    modifier = Modifier.width(${num(it.width)}.dp),\n)`,
  }),
  "search-bar": () => (values, it) => ({
    html: `<div class="searchbar" style="width:${num(it.width)}px">${iconSvg(
      values.leading,
      22,
    )}<input placeholder="${html(values.placeholder)}"></div>`,
    kt: `var query by remember { mutableStateOf("") }\nSearchBar(\n    inputField = {\n        SearchBarDefaults.InputField(\n            query = query, onQueryChange = { query = it },\n            onSearch = { /* TODO */ }, expanded = false, onExpandedChange = {},\n            placeholder = { Text(${kt(
      values.placeholder,
    )}) },\n            leadingIcon = { Icon(${iconKt(
      values.leading,
    )}, contentDescription = null) },\n        )\n    },\n    expanded = false, onExpandedChange = {},\n    modifier = Modifier.width(${num(
      it.width,
    )}.dp),\n) {}`,
  }),
  select: () => (values, it) => ({
    html: `<select class="field__input" style="width:${num(it.width)}px">${list(
      values.options,
    )
      .map((option) => `<option>${html(option)}</option>`)
      .join("")}</select>`,
    kt: `var expanded by remember { mutableStateOf(false) }\nExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {\n    OutlinedTextField(value = ${kt(
      values.value,
    )}, onValueChange = {}, readOnly = true, modifier = Modifier.menuAnchor())\n    ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {\n${list(
      values.options,
    )
      .map(
        (option) =>
          `        DropdownMenuItem(text = { Text(${kt(
            option,
          )}) }, onClick = { expanded = false })`,
      )
      .join("\n")}\n    }\n}`,
  }),
  pills: () => (values) => {
    const labels = list(values.labels);
    return {
      html: `<div class="chips">${labels
        .map(
          (label, index) =>
            `<button class="chip${
              values.active === index + 1 ? " is-active" : ""
            }">${html(label)}</button>`,
        )
        .join("")}</div>`,
      kt: `Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {\n${labels
        .map(
          (label, index) =>
            `    FilterChip(selected = ${
              values.active === index + 1
            }, onClick = { /* TODO */ }, label = { Text(${kt(label)}) })`,
        )
        .join("\n")}\n}`,
    };
  },
  badge: () => (values) => ({
    html: `<span class="badge badge--${values.tone}">${html(
      values.text,
    )}</span>`,
    kt:
      values.look === "dot" ? "Badge()" : `Badge { Text(${kt(values.text)}) }`,
  }),
  progress: () => (values, it) => ({
    html: `<progress value="${values.value}" max="100" style="width:${num(
      it.width,
    )}px"></progress>`,
    kt:
      values.style === "ring"
        ? `CircularProgressIndicator(progress = { ${(
            values.value / 100
          ).toFixed(2)}f })`
        : `LinearProgressIndicator(progress = { ${(values.value / 100).toFixed(
            2,
          )}f }, modifier = Modifier.width(${num(it.width)}.dp))`,
  }),
  snackbar: () => (values) => ({
    html: `<div class="snackbar" role="status"><span>${html(
      values.message,
    )}</span>${
      values.action ? `<button>${html(values.action)}</button>` : ""
    }</div>`,
    kt: `Snackbar(action = {${
      values.action
        ? ` TextButton(onClick = { /* TODO */ }) { Text(${kt(
            values.action,
          )}) } `
        : ""
    }}) { Text(${kt(values.message)}) }`,
  }),
  card: (theme) => (values, it) => ({
    html: `<article class="card card--${values.look}" style="width:${num(
      it.width,
    )}px">${values.media ? '<div class="card__media"></div>' : ""}<h3>${html(
      values.title,
    )}</h3><p>${html(values.body)}</p></article>`,
    kt: `${
      values.look === "outlined"
        ? "OutlinedCard"
        : values.look === "filled"
        ? "Card"
        : "ElevatedCard"
    }(\n    shape = RoundedCornerShape(${rad(
      theme,
      "card",
    )}.dp),\n    modifier = Modifier.width(${num(it.width)}.dp),\n) {\n${
      values.media
        ? "    Box(Modifier.fillMaxWidth().height(80.dp).background(MaterialTheme.colorScheme.secondaryContainer))\n"
        : ""
    }    Column(Modifier.padding(16.dp)) {\n        Text(${kt(
      values.title,
    )}, style = MaterialTheme.typography.titleMedium)\n        Text(${kt(
      values.body,
    )}, style = MaterialTheme.typography.bodySmall)\n    }\n}`,
  }),
  tabs: () => (values) => {
    const labels = list(values.labels);
    return {
      html: `<div class="tabs" role="tablist">${labels
        .map(
          (label, index) =>
            `<button role="tab" aria-selected="${
              values.active === index + 1
            }">${html(label)}</button>`,
        )
        .join("")}</div>`,
      kt: `TabRow(selectedTabIndex = ${values.active - 1}) {\n${labels
        .map(
          (label, index) =>
            `    Tab(selected = ${
              values.active === index + 1
            }, onClick = { /* TODO */ }, text = { Text(${kt(label)}) })`,
        )
        .join("\n")}\n}`,
    };
  },
  "app-bar": () => (values, it) => ({
    html: `<header class="appbar" style="width:${num(it.width)}px">${
      values.leading !== "none"
        ? `<button class="icon-btn" aria-label="${html(
            values.leading,
          )}">${iconSvg(values.leading, 24)}</button>`
        : ""
    }<h1>${html(values.title)}</h1></header>`,
    kt: `${
      values.size === "center"
        ? "CenterAlignedTopAppBar"
        : values.size === "medium"
        ? "MediumTopAppBar"
        : values.size === "large"
        ? "LargeTopAppBar"
        : "TopAppBar"
    }(\n    title = { Text(${kt(values.title)}) },${
      values.leading !== "none"
        ? `\n    navigationIcon = { IconButton(onClick = { /* TODO */ }) { Icon(${iconKt(
            values.leading,
          )}, contentDescription = null) } },`
        : ""
    }\n)`,
  }),
  "navigation-bar": () => (values) => {
    const items = list(values.items).map((entry) =>
      entry.split(":").map((x) => x.trim()),
    );
    return {
      html: `<nav class="navbar">${items
        .map(
          ([label, icon], index) =>
            `<a${
              values.active === index + 1 ? ' class="is-active"' : ""
            }>${iconSvg(icon ?? "home", 24)}<span>${html(label)}</span></a>`,
        )
        .join("")}</nav>`,
      kt: `NavigationBar {\n${items
        .map(
          ([label, icon], index) =>
            `    NavigationBarItem(selected = ${
              values.active === index + 1
            }, onClick = { /* TODO */ }, icon = { Icon(${iconKt(
              icon ?? "home",
            )}, contentDescription = null) }, label = { Text(${kt(label)}) })`,
        )
        .join("\n")}\n}`,
    };
  },
  dialog: () => (values) => ({
    html: `<dialog open class="dialog"><h2>${html(values.title)}</h2><p>${html(
      values.body,
    )}</p><div class="dialog__actions"><button>${html(
      values.cancel,
    )}</button><button class="btn btn--filled">${html(
      values.confirm,
    )}</button></div></dialog>`,
    kt: `AlertDialog(\n    onDismissRequest = { /* TODO */ },\n    title = { Text(${kt(
      values.title,
    )}) },\n    text = { Text(${kt(
      values.body,
    )}) },\n    confirmButton = { TextButton(onClick = { /* TODO */ }) { Text(${kt(
      values.confirm,
    )}) } },\n    dismissButton = { TextButton(onClick = { /* TODO */ }) { Text(${kt(
      values.cancel,
    )}) } },\n)`,
  }),
  menu: () => (values) => {
    const items = list(values.items);
    return {
      html: `<ul class="menu" role="menu">${items
        .map((item) => `<li role="menuitem">${html(item)}</li>`)
        .join("")}</ul>`,
      kt: `DropdownMenu(expanded = true, onDismissRequest = { /* TODO */ }) {\n${items
        .map(
          (item) =>
            `    DropdownMenuItem(text = { Text(${kt(
              item,
            )}) }, onClick = { /* TODO */ })`,
        )
        .join("\n")}\n}`,
    };
  },
  "segmented-buttons": () => (values) => {
    const labels = list(values.labels);
    return {
      html: `<div class="segmented" role="group">${labels
        .map(
          (label, index) =>
            `<button aria-pressed="${values.active === index + 1}">${html(
              label,
            )}</button>`,
        )
        .join("")}</div>`,
      kt: `SingleChoiceSegmentedButtonRow {\n${labels
        .map(
          (label, index) =>
            `    SegmentedButton(selected = ${
              values.active === index + 1
            }, onClick = { /* TODO */ }, shape = SegmentedButtonDefaults.itemShape(index = ${index}, count = ${
              labels.length
            })) { Text(${kt(label)}) }`,
        )
        .join("\n")}\n}`,
    };
  },
  list: () => (values) => {
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
    const rows = Array.from(
      { length: values.rows },
      (_, index) => names[index % 10],
    );
    return {
      html: `<ul class="list">${rows
        .map(
          (row) =>
            `<li><strong>${html(row)}</strong>${
              values.lines === "two" ? "<span>Secondary text</span>" : ""
            }</li>`,
        )
        .join("")}</ul>`,
      kt: `LazyColumn {\n    items(listOf(${rows
        .map(kt)
        .join(
          ", ",
        )})) { item ->\n        ListItem(headlineContent = { Text(item) }${
        values.lines === "two"
          ? ', supportingContent = { Text("Secondary text") }'
          : ""
      })\n    }\n}`,
    };
  },
};
