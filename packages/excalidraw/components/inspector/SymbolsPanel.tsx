import { useState } from "react";

import { CustomSymbolSection } from "./CustomSymbolSection";
import { CodeSection } from "./symbols/CodeSection";
import { SymbolLayoutSection } from "./symbols/SymbolLayoutSection";
import { SymbolLibrary } from "./symbols/SymbolLibrary";
import { ThemeSection } from "./symbols/ThemeSection";
import { useSymbolTheme } from "./symbols/themeStore";

import type App from "../App";

export { SymbolLayoutSection };

/** UI components and icons in a theme: pick one, set its parameters, put it on the canvas. */
export const SymbolsPanel = ({ app }: { app: App }) => {
  const theme = useSymbolTheme();
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="symbols" data-testid="symbols-panel">
      <SymbolLayoutSection app={app} />
      <CustomSymbolSection app={app} />
      <CodeSection app={app} />
      <ThemeSection app={app} theme={theme} note={note} onNote={setNote} />
      <SymbolLibrary app={app} theme={theme} onNote={setNote} />
    </div>
  );
};
