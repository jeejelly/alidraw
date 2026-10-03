import {
  HARMONIES,
  PALETTE_PRESETS,
  contrast,
  harmony,
  hexToHsl,
  hslToHex,
  mostVivid,
  themeFromHarmony,
} from "@excalidraw/color";
import { TOKENS } from "@excalidraw/symbols";

const hue = (hex: string) => hexToHsl(hex).h;
const gap = (first: number, second: number) =>
  Math.abs(((first - second + 540) % 360) - 180);

describe("colour harmonies", () => {
  it("round-trips colours through HSL", () => {
    for (const hex of [
      "#ff6b57",
      "#1fcf9b",
      "#4f8dff",
      "#808080",
      "#000000",
      "#ffffff",
    ]) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
    expect(hexToHsl("#ff0000")).toMatchObject({ h: 0, s: 100, l: 50 });
  });

  it("every rule gives five colours and keeps the base where it says", () => {
    for (const { id } of HARMONIES) {
      const { colors, index } = harmony("#3b82f6", id);
      expect(colors).toHaveLength(5);
      expect(colors[index]).toBe("#3b82f6");
    }
  });

  it("puts the hues where the rule puts them", () => {
    const base = "#e8590c";
    const h0 = hue(base);
    const analogous = harmony(base, "analogous").colors.map(hue);
    expect(gap(analogous[1], h0)).toBeCloseTo(30, 0);
    expect(gap(analogous[4], h0)).toBeCloseTo(60, 0);
    const triad = harmony(base, "triad").colors.map(hue);
    expect(gap(triad[1], h0)).toBeCloseTo(120, 0);
    expect(gap(triad[2], h0)).toBeCloseTo(120, 0);
    const comp = harmony(base, "complementary").colors.map(hue);
    expect(gap(comp[3], h0)).toBeCloseTo(180, 0);
    const split = harmony(base, "split").colors.map(hue);
    expect(gap(split[1], h0)).toBeCloseTo(150, 0);
    expect(gap(split[2], h0)).toBeCloseTo(150, 0);
    const square = harmony(base, "square").colors.map(hue);
    expect(
      [1, 2, 3].map((index) => Math.round(gap(square[index], h0))),
    ).toEqual([90, 180, 90]);
    // monochromatic and shades keep one hue, shades step the lightness
    expect(
      new Set(
        harmony(base, "monochromatic").colors.map((color) =>
          Math.round(hue(color) / 3),
        ),
      ).size,
    ).toBe(1);
    const ls = harmony(base, "shades").colors.map((color) => hexToHsl(color).l);
    expect([...ls].sort((first, second) => first - second)).toEqual(ls);
  });

  it("builds a whole theme: every token, readable, tinted by the base", () => {
    for (const mode of ["light", "dark"] as const) {
      for (const base of [
        "#ff6b57",
        "#4f8dff",
        "#f5c542",
        "#1fcf9b",
        "#6c5ce7",
      ]) {
        const theme = themeFromHarmony(base, "analogous", mode);
        expect(Object.keys(theme).sort()).toEqual([...TOKENS].sort());
        // text on the page and on a sheet, the label on the accent
        expect(contrast(theme.text, theme.page)).toBeGreaterThan(7);
        expect(contrast(theme.text, theme.surface)).toBeGreaterThan(7);
        expect(contrast(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(contrast(theme.muted, theme.page)).toBeGreaterThan(3);
        // light themes are light, dark ones dark
        expect(hexToHsl(theme.page).l).toBeGreaterThan(
          mode === "light" ? 90 : 0,
        );
        expect(hexToHsl(theme.page).l).toBeLessThan(
          mode === "light" ? 101 : 20,
        );
        // the neutrals lean to the base hue
        if (hexToHsl(base).s > 40) {
          expect(gap(hue(theme.surfaceAlt), hue(base))).toBeLessThan(12);
        }
      }
    }
    // success is green-ish and danger red-ish
    const theme = themeFromHarmony("#4f8dff", "triad");
    expect(gap(hue(theme.success), 140)).toBeLessThan(50);
    expect(
      Math.min(gap(hue(theme.danger), 0), gap(hue(theme.danger), 360)),
    ).toBeLessThan(45);
  });

  it("takes a green or a red from the harmony when it has one", () => {
    // a green base: its harmony's success is the base's own neighbour
    const theme = themeFromHarmony("#2fa84f", "analogous");
    expect(gap(hue(theme.success), hue("#2fa84f"))).toBeLessThan(70);
  });

  it("ships palettes of valid colours, and picks the most vivid", () => {
    expect(PALETTE_PRESETS.length).toBeGreaterThanOrEqual(12);
    for (const preset of PALETTE_PRESETS) {
      expect(preset.colors.length).toBeGreaterThanOrEqual(6);
      expect(
        preset.colors.every((color) => /^#[0-9a-f]{6}$/i.test(color)),
      ).toBe(true);
    }
    expect(mostVivid(["#f4f4f7", "#808080", "#e8590c", "#222222"])).toBe(
      "#e8590c",
    );
  });
});
