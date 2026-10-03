import { useState } from "react";

import {
  addSwatches,
  themeFromHarmony,
  type HarmonyRule,
} from "@excalidraw/color";

import type { SymbolTheme } from "@excalidraw/symbols";

import { ColorHarmony } from "../ColorHarmony";

import { setSymbolTheme } from "./themeStore";

import type App from "../../App";

/** Colours that go together, to make the whole theme from: a base colour and a rule. */
export const HarmonyTheme = ({
  app,
  theme,
}: {
  app: App;
  theme: SymbolTheme;
}) => {
  const [open, setOpen] = useState(false);
  const [kept, setKept] = useState<string | null>(null);
  const makeTheme =
    (mode: "light" | "dark") =>
    (_colors: string[], base: string, rule: HarmonyRule) =>
      setSymbolTheme({
        ...theme,
        name: `Harmony ${base}`,
        colors: themeFromHarmony(base, rule, mode),
      });
  return (
    <>
      <button
        type="button"
        className="inspector__action"
        data-testid="symbols-harmony-toggle"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {open ? "Hide the colour harmonies" : "Colour harmonies…"}
      </button>
      {open && (
        <ColorHarmony
          app={app}
          initial={theme.colors.accent}
          actions={[
            {
              id: "light",
              label: "Light theme",
              title: "Make the whole theme from this colour, light",
              run: makeTheme("light"),
            },
            {
              id: "dark",
              label: "Dark theme",
              title: "Make the whole theme from this colour, dark",
              run: makeTheme("dark"),
            },
            {
              id: "keep",
              label: "Keep in swatches",
              run: (colors) => {
                const count = addSwatches(
                  colors.map((color, index) => ({
                    name: `Harmony ${index + 1} ${color}`,
                    color,
                  })),
                );
                setKept(`${count} colours added to the swatches.`);
              },
            },
          ]}
        />
      )}
      {kept && <p className="symbols__note">{kept}</p>}
    </>
  );
};
