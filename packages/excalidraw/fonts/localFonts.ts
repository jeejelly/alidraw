/**
 * Fonts installed on the machine, through the Local Font Access API
 * (Chromium; it asks the user for permission). Elsewhere the list is empty.
 */
type LocalFontData = { family: string };

let cache: string[] | null = null;
let pending: Promise<string[]> | null = null;

export const isLocalFontAccessSupported = () =>
  typeof window !== "undefined" && "queryLocalFonts" in window;

/** distinct family names, sorted; [] when unsupported or denied */
export const getLocalFontFamilies = async (): Promise<string[]> => {
  if (cache) {
    return cache;
  }
  if (!isLocalFontAccessSupported()) {
    return [];
  }
  pending ??= (async () => {
    try {
      const fonts: LocalFontData[] = await (window as any).queryLocalFonts();
      cache = [...new Set(fonts.map((font) => font.family))].sort(
        (first, second) => first.localeCompare(second),
      );
      return cache;
    } catch {
      // permission denied or no user activation
      return [];
    } finally {
      pending = null;
    }
  })();
  return pending;
};

export const filterFontFamilies = (
  families: readonly string[],
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();
  return normalizedQuery
    ? families.filter((family) =>
        family.toLowerCase().includes(normalizedQuery),
      )
    : [...families];
};
