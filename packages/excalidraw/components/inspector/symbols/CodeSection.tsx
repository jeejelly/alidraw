import { useState } from "react";

import {
  collectCodeItems,
  generateCode,
  generateResponsiveSceneCode,
  generateSceneCode,
  type SymbolTheme,
} from "@excalidraw/symbols";

import { Section } from "../primitives";

import { useSymbolTheme } from "./themeStore";

import type App from "../../App";

type CodeKind = "html" | "compose";
type CodeScope = "selection" | "all" | "scene" | "flow";
type Generated = { code?: { html: string; compose: string }; info: string };

const generateFromScene = (
  app: App,
  scope: "scene" | "flow",
  theme: SymbolTheme,
): Generated => {
  const generate =
    scope === "flow" ? generateResponsiveSceneCode : generateSceneCode;
  const scene = generate(app.scene.getNonDeletedElements(), theme);
  if (!scene) {
    return { info: "The canvas is empty." };
  }
  return {
    code: scene,
    info: `${scene.count} parts on a ${scene.width} x ${
      scene.height
    } page. ${scene.notes.join(" ")}`,
  };
};

const generateFromSymbols = (
  app: App,
  scope: "selection" | "all",
  theme: SymbolTheme,
): Generated => {
  const selected = app.scene.getSelectedElements(app.state);
  const all = app.scene.getNonDeletedElements();
  // a selected group stands for all of its members
  const groups = new Set(
    selected.map((element) => element.groupIds[0]).filter(Boolean),
  );
  const members =
    scope === "selection"
      ? all.filter(
          (element) =>
            selected.includes(element) ||
            (element.groupIds[0] && groups.has(element.groupIds[0])),
        )
      : all;
  const items = collectCodeItems(members);
  if (!items.length) {
    return {
      info:
        scope === "selection"
          ? "Select symbols first."
          : "No symbols on the canvas.",
    };
  }
  const output = generateCode(items, theme);
  const unmapped = output.unmapped.length
    ? `; no code yet for: ${[...new Set(output.unmapped)].join(", ")}`
    : "";
  return {
    code: output,
    info: `${output.count} component${
      output.count === 1 ? "" : "s"
    }${unmapped}.`,
  };
};

const saveTextFile = (text: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Starting code for the symbols on the canvas: HTML and Jetpack Compose. */
export const CodeSection = ({ app }: { app: App }) => {
  const theme = useSymbolTheme();
  const [kind, setKind] = useState<CodeKind>("html");
  const [scope, setScope] = useState<CodeScope>("selection");
  const [text, setText] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  const make = (requestedKind: CodeKind) => {
    const { code, info: message } =
      scope === "scene" || scope === "flow"
        ? generateFromScene(app, scope, theme)
        : generateFromSymbols(app, scope, theme);
    setInfo(message);
    if (!code) {
      setText("");
      return;
    }
    setKind(requestedKind);
    setText(requestedKind === "html" ? code.html : code.compose);
  };

  return (
    <Section title="Code" testId="symbols-code">
      <div className="symbols__row">
        <label className="symbols__param" style={{ flex: 1 }}>
          <span>From</span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as CodeScope)}
            data-testid="symbols-code-scope"
          >
            <option value="selection">the selection</option>
            <option value="all">every symbol (stacked)</option>
            <option value="flow">the whole canvas (rows and columns)</option>
            <option value="scene">the whole canvas (positioned)</option>
          </select>
        </label>
      </div>
      <div className="symbols__row">
        <button
          type="button"
          data-testid="symbols-code-html"
          onClick={() => make("html")}
        >
          HTML + CSS
        </button>
        <button
          type="button"
          data-testid="symbols-code-compose"
          onClick={() => make("compose")}
        >
          Jetpack Compose
        </button>
      </div>
      {info && <p className="symbols__note">{info}</p>}
      {text && (
        <>
          <textarea
            className="symbols__code"
            data-testid="symbols-code-text"
            readOnly
            value={text}
            onKeyDown={(event) => event.stopPropagation()}
          />
          <div className="symbols__row">
            <button
              type="button"
              data-testid="symbols-code-copy"
              onClick={() =>
                navigator.clipboard?.writeText(text).then(
                  () => setInfo("Copied."),
                  () => setInfo("Could not copy."),
                )
              }
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() =>
                saveTextFile(
                  text,
                  kind === "html" ? "screen.html" : "Screen.kt",
                )
              }
            >
              Save file
            </button>
          </div>
        </>
      )}
    </Section>
  );
};
