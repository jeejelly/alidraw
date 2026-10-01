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
      cache = [...new Set(fonts.map((f) => f.family))].sort((a, b) =>
        a.localeCompare(b),
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
  const q = query.trim().toLowerCase();
  return q
    ? families.filter((f) => f.toLowerCase().includes(q))
    : [...families];
};
