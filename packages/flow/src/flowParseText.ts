const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

/** the text of a label: quotes removed, `<br>` and `#quot;` / `#35;` entities decoded */
export const unquote = (raw: string) => {
  let text = raw.trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/#([a-z]+);/gi, (whole, name) => NAMED_ENTITIES[name] ?? whole)
    .replace(/&quot;/g, '"')
    .trim();
};

export const quote = (label: string) =>
  `"${label.replace(/"/g, "#quot;").replace(/\r?\n/g, "<br/>") || " "}"`;
