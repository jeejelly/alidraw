import { useState } from "react";

import { getSelectedSymbol } from "@excalidraw/symbols";
import {
  customOf,
  isCustom,
  labelFor,
  membersOf,
  type CustomParam,
  type CustomProp,
} from "@excalidraw/symbols";
import {
  addCustomParam,
  removeCustomParam,
  renameCustomParam,
  setCustomParam,
} from "@excalidraw/symbols";

import { actionConvertToSymbol } from "../../actions/actionConvertToSymbol";
import { actionAddToLibrary } from "../../actions";

import { ColorField } from "./ColorField";
import { NumberPill, Section } from "./primitives";

import type App from "../App";

const SHAPE_PROPS: CustomProp[] = [
  "backgroundColor",
  "strokeColor",
  "strokeWidth",
  "opacity",
  "visible",
];
const TEXT_PROPS: CustomProp[] = ["text", "strokeColor", "opacity", "visible"];

/**
 * Custom symbols: convert a drawing into a component, then set its parameters
 * (background, outline, texts…) here; inside a symbol, a part can expose more.
 */
export const CustomSymbolSection = ({ app }: { app: App }) => {
  const [, bump] = useState(0);
  const [prop, setProp] = useState<CustomProp>("backgroundColor");
  const [label, setLabel] = useState("");
  const selected = app.scene.getSelectedElements(app.state);
  if (!selected.length) {
    return null;
  }
  const all = app.scene.getNonDeletedElements();
  const symbol = getSelectedSymbol(selected, all);
  const whole = symbol && isCustom(symbol.members[0]) ? symbol : null;
  const part =
    !symbol && selected.length === 1 && isCustom(selected[0])
      ? selected[0]
      : null;
  const done = () => {
    app.scene.triggerUpdate();
    app.store.scheduleCapture();
    bump((count) => count + 1);
  };

  if (!whole && !part) {
    if (symbol) {
      return null; // a built-in component: its own panel
    }
    return (
      <Section title="Custom symbol" testId="symbols-custom">
        <button
          type="button"
          className="inspector__action"
          data-testid="symbols-convert"
          onClick={() => app.actionManager.executeAction(actionConvertToSymbol)}
        >
          Convert to symbol
        </button>
        <p className="symbols__note">
          Turns the drawing into a component: its background, outline and texts
          become parameters you can set, and stretching keeps its layout.
        </p>
      </Section>
    );
  }

  if (part) {
    const members = membersOf(all, part);
    const choices = part.type === "text" ? TEXT_PROPS : SHAPE_PROPS;
    const current = choices.includes(prop) ? prop : choices[0];
    return (
      <Section title="Part of a symbol" testId="symbols-custom-part">
        <label className="symbols__param">
          <span>Expose</span>
          <select
            data-testid="symbols-expose-prop"
            value={current}
            onChange={(changeEvent) =>
              setProp(changeEvent.target.value as CustomProp)
            }
          >
            {choices.map((option) => (
              <option key={option} value={option}>
                {labelFor(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="symbols__param">
          <span>Name</span>
          <input
            data-testid="symbols-expose-label"
            value={label}
            placeholder={labelFor(current)}
            onChange={(changeEvent) => setLabel(changeEvent.target.value)}
            onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
          />
        </label>
        <button
          type="button"
          className="inspector__action"
          data-testid="symbols-expose"
          onClick={() => {
            addCustomParam(
              app.scene,
              members,
              part,
              current,
              label.trim() || labelFor(current),
            );
            setLabel("");
            done();
          }}
        >
          Make it a parameter
        </button>
        <p className="symbols__note">
          Parts with the same value (every part with this fill, say) follow it.
        </p>
      </Section>
    );
  }

  const members = whole!.members;
  const { params, name } = customOf(members);
  const editor = (param: CustomParam) => {
    const set = (value: string | number | boolean) => {
      setCustomParam(app.scene, members, param.key, value);
      done();
    };
    if (param.kind === "color") {
      return (
        <ColorField
          compact
          label={param.label}
          testId={`symbols-param-${param.key}`}
          value={String(param.value)}
          onChange={set}
        />
      );
    }
    if (param.kind === "text") {
      return (
        <input
          className="inspector__text"
          data-testid={`symbols-param-${param.key}`}
          defaultValue={String(param.value)}
          key={String(param.value)}
          onKeyDown={(keyEvent) => {
            keyEvent.stopPropagation();
            if (keyEvent.key === "Enter") {
              (keyEvent.target as HTMLInputElement).blur();
            }
          }}
          onBlur={(blurEvent) =>
            blurEvent.target.value !== param.value &&
            set(blurEvent.target.value)
          }
        />
      );
    }
    if (param.kind === "toggle") {
      return (
        <input
          type="checkbox"
          data-testid={`symbols-param-${param.key}`}
          checked={!!param.value}
          onChange={(changeEvent) => set(changeEvent.target.checked)}
        />
      );
    }
    return (
      <NumberPill
        label={param.label}
        testId={`symbols-param-${param.key}`}
        value={Number(param.value)}
        min={param.min ?? 0}
        max={param.max ?? 100}
        onCommit={set}
      />
    );
  };

  return (
    <Section title={`Symbol: ${name}`} testId="symbols-custom">
      {params.length === 0 && (
        <p className="symbols__note">
          No parameters yet: select a part inside the symbol (double-click) and
          make one of its properties a parameter.
        </p>
      )}
      {params.map((param) => (
        <div
          className="symbols__param"
          key={param.key}
          data-testid="symbols-custom-param"
        >
          <input
            className="symbols__param-name"
            aria-label="Parameter name"
            defaultValue={param.label}
            onKeyDown={(keyEvent) => {
              keyEvent.stopPropagation();
              if (keyEvent.key === "Enter") {
                (keyEvent.target as HTMLInputElement).blur();
              }
            }}
            onBlur={(blurEvent) => {
              if (
                blurEvent.target.value.trim() &&
                blurEvent.target.value !== param.label
              ) {
                renameCustomParam(
                  app.scene,
                  members,
                  param.key,
                  blurEvent.target.value,
                );
                done();
              }
            }}
          />
          {editor(param)}
          <button
            type="button"
            aria-label={`Remove ${param.label}`}
            title="Remove this parameter"
            data-testid={`symbols-param-remove-${param.key}`}
            onClick={() => {
              removeCustomParam(app.scene, members, param.key);
              done();
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="inspector__action"
        data-testid="symbols-custom-library"
        onClick={() => app.actionManager.executeAction(actionAddToLibrary)}
      >
        Add to the library
      </button>
    </Section>
  );
};
