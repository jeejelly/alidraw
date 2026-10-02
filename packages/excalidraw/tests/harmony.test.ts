import {
  HARMONIES,
  PALETTE_PRESETS,
  contrast,
  harmony,
  hexToHsl,
  hslToHex,
  mostVivid,
  themeFromHarmony,
} from "../color/harmony";
import { TOKENS } from "../symbols/theme";

const hue = (hex: string) => hexToHsl(hex).h;
const gap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

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
    expect([1, 2, 3].map((i) => Math.round(gap(square[i], h0)))).toEqual([
      90, 180, 90,
    ]);
    // monochromatic and shades keep one hue, shades step the lightness
    expect(
      new Set(
        harmony(base, "monochromatic").colors.map((c) =>
          Math.round(hue(c) / 3),
        ),
      ).size,
    ).toBe(1);
    const ls = harmony(base, "shades").colors.map((c) => hexToHsl(c).l);
    expect([...ls].sort((a, b) => a - b)).toEqual(ls);
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
        const t = themeFromHarmony(base, "analogous", mode);
        expect(Object.keys(t).sort()).toEqual([...TOKENS].sort());
        // text on the page and on a sheet, the label on the accent
        expect(contrast(t.text, t.page)).toBeGreaterThan(7);
        expect(contrast(t.text, t.surface)).toBeGreaterThan(7);
        expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.muted, t.page)).toBeGreaterThan(3);
        // light themes are light, dark ones dark
        expect(hexToHsl(t.page).l).toBeGreaterThan(mode === "light" ? 90 : 0);
        expect(hexToHsl(t.page).l).toBeLessThan(mode === "light" ? 101 : 20);
        // the neutrals lean to the base hue
        if (hexToHsl(base).s > 40) {
          expect(gap(hue(t.surfaceAlt), hue(base))).toBeLessThan(12);
        }
      }
    }
    // success is green-ish and danger red-ish
    const t = themeFromHarmony("#4f8dff", "triad");
    expect(gap(hue(t.success), 140)).toBeLessThan(50);
    expect(
      Math.min(gap(hue(t.danger), 0), gap(hue(t.danger), 360)),
    ).toBeLessThan(45);
  });

  it("takes a green or a red from the harmony when it has one", () => {
    // a green base: its harmony's success is the base's own neighbour
    const t = themeFromHarmony("#2fa84f", "analogous");
    expect(gap(hue(t.success), hue("#2fa84f"))).toBeLessThan(70);
  });

  it("ships palettes of valid colours, and picks the most vivid", () => {
    expect(PALETTE_PRESETS.length).toBeGreaterThanOrEqual(12);
    for (const p of PALETTE_PRESETS) {
      expect(p.colors.length).toBeGreaterThanOrEqual(6);
      expect(p.colors.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
    }
    expect(mostVivid(["#f4f4f7", "#808080", "#e8590c", "#222222"])).toBe(
      "#e8590c",
    );
  });
});
