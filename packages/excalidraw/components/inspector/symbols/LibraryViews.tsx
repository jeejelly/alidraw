import {
  ILLUSTRATIONS,
  TEMPLATES,
  buildTemplate,
  templateShapes,
} from "@excalidraw/symbols";

import { importSvg } from "@excalidraw/vector";

import type { ComponentDef, SymbolTheme, Values } from "@excalidraw/symbols";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { ParamField } from "./ParamField";
import { SymbolPreview } from "./SymbolPreview";

import type App from "../../App";

type Insert = (elements: readonly ExcalidrawElement[]) => void;

const matches = (query: string, ...fields: (string | undefined)[]) =>
  !query || fields.join(" ").toLowerCase().includes(query);

export const ArtGrid = ({
  query,
  insert,
}: {
  query: string;
  insert: Insert;
}) => (
  <div
    className="symbols__grid symbols__grid--screens"
    data-testid="symbols-art"
  >
    {ILLUSTRATIONS.filter((art) => matches(query, art.name, art.tags)).map(
      (art) => (
        <button
          key={art.id}
          type="button"
          className="symbols__tile"
          data-testid="symbols-art-item"
          title={`${art.name}: vector paths, every shape editable`}
          onClick={() => insert(importSvg(art.svg, { x: 0, y: 0 }).elements)}
        >
          <img
            alt={art.name}
            width={136}
            height={136}
            src={`data:image/svg+xml;utf8,${encodeURIComponent(art.svg)}`}
          />
          <span>{art.name}</span>
        </button>
      ),
    )}
  </div>
);

export const TemplateGrid = ({
  query,
  theme,
  insert,
}: {
  query: string;
  theme: SymbolTheme;
  insert: Insert;
}) => (
  <div
    className="symbols__grid symbols__grid--screens"
    data-testid="symbols-templates"
  >
    {TEMPLATES.filter((template) =>
      matches(query, template.name, template.tags),
    ).map((template) => (
      <button
        key={template.id}
        type="button"
        className="symbols__tile"
        data-testid="symbols-template"
        title={`${template.name}: ${template.parts.length} parts, each one editable`}
        onClick={() => insert(buildTemplate(template, theme))}
      >
        <SymbolPreview
          shapes={templateShapes(template, theme)}
          theme={theme}
          width={136}
          height={190}
        />
        <span>{template.name}</span>
      </button>
    ))}
  </div>
);

export const ComponentsView = ({
  app,
  theme,
  components,
  picked,
  values,
  valuesOf,
  onPick,
  onChangeValue,
  onInsert,
  onNote,
}: {
  app: App;
  theme: SymbolTheme;
  components: readonly ComponentDef[];
  picked: ComponentDef | null;
  values: Record<string, Values>;
  valuesOf: (def: ComponentDef) => Values;
  onPick: (id: string) => void;
  onChangeValue: (componentId: string, key: string, value: any) => void;
  onInsert: (def: ComponentDef) => void;
  onNote: (note: string) => void;
}) => (
  <>
    {picked && (
      <div className="symbols__detail" data-testid="symbols-detail">
        <strong>{picked.name}</strong>
        <SymbolPreview
          shapes={picked.shapes(theme, valuesOf(picked))}
          theme={theme}
          width={300}
          height={170}
        />
        {(picked.params ?? []).map((param) => (
          <ParamField
            key={param.key}
            param={param}
            value={valuesOf(picked)[param.key]}
            onChange={(value) => onChangeValue(picked.id, param.key, value)}
          />
        ))}
        <button
          type="button"
          className="symbols__insert"
          data-testid="symbols-insert"
          onClick={() => onInsert(picked)}
        >
          Insert on canvas
        </button>
        <button
          type="button"
          className="symbols__replace"
          data-testid="symbols-replace"
          disabled={app.symbols.replaceable().length === 0}
          title="Each selected shape becomes this component, keeping its text as the label and its links"
          onClick={() => {
            const count = app.symbols.replace(
              picked.id,
              values[picked.id] ?? {},
              theme,
            );
            onNote(`${count} shape${count === 1 ? "" : "s"} replaced.`);
          }}
        >
          Replace selected shapes
        </button>
      </div>
    )}
    <div className="symbols__grid" data-testid="symbols-grid">
      {components.map((component) => (
        <button
          key={component.id}
          type="button"
          className={`symbols__tile${
            picked?.id === component.id ? " is-picked" : ""
          }`}
          data-testid="symbols-tile"
          title={component.name}
          onClick={() => onPick(component.id)}
          onDoubleClick={() => onInsert(component)}
        >
          <SymbolPreview
            shapes={component.shapes(theme, valuesOf(component))}
            theme={theme}
            width={136}
            height={84}
          />
          <span>{component.name}</span>
        </button>
      ))}
      {components.length === 0 && (
        <p className="symbols__note">Nothing matches.</p>
      )}
    </div>
  </>
);

export const IconsView = ({
  theme,
  icons,
  iconSize,
  onSizeChange,
  onInsert,
}: {
  theme: SymbolTheme;
  icons: readonly { name: string }[];
  iconSize: number;
  onSizeChange: (size: number) => void;
  onInsert: (name: string) => void;
}) => (
  <>
    <label className="symbols__param">
      <span>Size</span>
      <input
        type="number"
        min={8}
        max={256}
        value={iconSize}
        onKeyDown={(event) => event.stopPropagation()}
        onChange={(event) =>
          Number(event.target.value) > 0 &&
          onSizeChange(Number(event.target.value))
        }
      />
    </label>
    <div className="symbols__icons" data-testid="symbols-icons">
      {icons.map((icon) => (
        <button
          key={icon.name}
          type="button"
          className="symbols__icon"
          data-testid="symbols-icon"
          title={icon.name}
          onClick={() => onInsert(icon.name)}
        >
          <SymbolPreview
            shapes={[
              { t: "icon", name: icon.name, x: 0, y: 0, size: 24, s: "text" },
            ]}
            theme={theme}
            width={40}
            height={40}
          />
        </button>
      ))}
    </div>
  </>
);
