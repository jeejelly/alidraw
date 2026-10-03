import {
  getLayout,
  getSelectedSymbol,
  getSymbolMeta,
  type LayoutH,
  type LayoutV,
} from "@excalidraw/symbols";

import { Section } from "../primitives";

import { LayoutIcon, type LayoutKind } from "./LayoutIcon";

import type App from "../../App";

type Choice<Value> = [Value, LayoutKind, string];

const AUTO_TITLE =
  "Automatic: what spans grows, the rest goes to the nearest end";
const SCALE_TITLE = "Everything scales in proportion";

const H_CHOICES: Choice<LayoutH>[] = [
  ["auto", "auto", AUTO_TITLE],
  ["left", "start", "Everything that does not span stays at the left"],
  ["center", "center", "Everything that does not span stays centred"],
  ["right", "end", "Everything that does not span stays at the right"],
  ["scale", "scale", SCALE_TITLE],
];
const V_CHOICES: Choice<LayoutV>[] = [
  ["auto", "auto", AUTO_TITLE],
  ["top", "start", "Everything that does not span stays at the top"],
  ["middle", "center", "Everything that does not span stays in the middle"],
  ["bottom", "end", "Everything that does not span stays at the bottom"],
  ["scale", "scale", SCALE_TITLE],
];

/** How the selected component re-lays out when it is stretched with Ctrl + drag. */
export const SymbolLayoutSection = ({ app }: { app: App }) => {
  const selected = app.scene.getSelectedElements(app.state);
  const symbol = getSelectedSymbol(selected, app.scene.getNonDeletedElements());
  // one part of a component, picked inside its group
  const part =
    !symbol && selected.length === 1 && getSymbolMeta(selected[0])
      ? selected[0]
      : null;
  if (!symbol && !part) {
    return null;
  }

  const mutateMeta = (elements: readonly any[], patch: Record<string, any>) => {
    for (const element of elements) {
      app.scene.mutateElement(
        element,
        {
          customData: {
            ...element.customData,
            symbol: { ...element.customData?.symbol, ...patch },
          },
        },
        { informMutation: false, isDragging: false },
      );
    }
    app.scene.triggerUpdate();
    app.store.scheduleCapture();
  };

  if (part) {
    const meta = getSymbolMeta(part)!;
    return (
      <Section title="Layout" testId="symbols-layout">
        <label className="symbols__param">
          <span>Cover</span>
          <input
            type="checkbox"
            data-testid="symbols-cover"
            checked={!!meta.cover}
            onChange={(event) =>
              mutateMeta([part], { cover: event.target.checked })
            }
          />
        </label>
        <p className="symbols__note">
          Locked to the clipping zone: this part always covers the whole
          component, however it is stretched.
        </p>
      </Section>
    );
  }

  const layout = getLayout(symbol!.members);
  const setLayout = (patch: Partial<{ h: LayoutH; v: LayoutV }>) =>
    mutateMeta(symbol!.members, { layout: { ...layout, ...patch } });
  const row = (label: string, axis: "h" | "v", choices: Choice<string>[]) => (
    <>
      <div className="symbols__layout-title">{label}</div>
      <div className="symbols__layout">
        {choices.map(([value, kind, title]) => (
          <button
            key={value}
            type="button"
            className="symbols__layout-btn"
            title={title}
            aria-label={title}
            data-testid={`symbols-layout-${axis}-${value}`}
            aria-pressed={layout[axis] === value}
            onClick={() => setLayout({ [axis]: value } as any)}
          >
            <LayoutIcon kind={kind} vertical={axis === "v"} />
          </button>
        ))}
      </div>
    </>
  );
  return (
    <Section title="Layout" testId="symbols-layout">
      {row("When stretched sideways", "h", H_CHOICES)}
      {row("When stretched up or down", "v", V_CHOICES)}
      <p className="symbols__note">
        Ctrl + drag an edge to stretch. The frame flashes when it lines up with
        another component.
      </p>
    </Section>
  );
};
