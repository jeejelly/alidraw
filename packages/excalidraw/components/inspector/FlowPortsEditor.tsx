import { useState } from "react";

import {
  PORT_PRESETS,
  setStepPorts,
  stepPortsOf,
  type FlowPort,
  type FlowSelection,
} from "@excalidraw/flow";

import { t } from "../../i18n";

import { NumberPill } from "./primitives";

import type App from "../App";

type Step = Extract<NonNullable<FlowSelection>, { kind: "step" }>;
type At = FlowPort["at"];

const SIDES: Record<"top" | "right" | "bottom" | "left", At> = {
  top: [0.5, 0],
  right: [1, 0.5],
  bottom: [0.5, 1],
  left: [0, 0.5],
};

type Side = keyof typeof SIDES;
type Position = Side | "custom";

const SIDE_NAMES = Object.keys(SIDES) as Side[];

const positionOf = (at: At): Position =>
  SIDE_NAMES.find(
    (side) => SIDES[side][0] === at[0] && SIDES[side][1] === at[1],
  ) ?? "custom";

const PositionSelect = ({
  value,
  onChange,
  testId,
}: {
  value: Position;
  onChange: (position: Position) => void;
  testId: string;
}) => (
  <select
    className="inspector__select"
    data-testid={testId}
    aria-label={t("labels.flow.selection.position")}
    value={value}
    onChange={(event) => onChange(event.target.value as Position)}
  >
    {[...SIDE_NAMES, "custom" as const].map((position) => (
      <option key={position} value={position}>
        {t(`labels.flow.selection.${position}`)}
      </option>
    ))}
  </select>
);

const PercentPills = ({
  at,
  onChange,
  testId,
}: {
  at: At;
  onChange: (at: At) => void;
  testId: string;
}) => (
  <>
    <NumberPill
      label={t("labels.flow.selection.portX")}
      testId={`${testId}-x`}
      value={at[0] * 100}
      min={0}
      max={100}
      unit="%"
      onCommit={(percent) => onChange([percent / 100, at[1]])}
    />
    <NumberPill
      label={t("labels.flow.selection.portY")}
      testId={`${testId}-y`}
      value={at[1] * 100}
      min={0}
      max={100}
      unit="%"
      onCommit={(percent) => onChange([at[0], percent / 100])}
    />
  </>
);

const AddPort = ({
  taken,
  onAdd,
}: {
  taken: (name: string) => boolean;
  onAdd: (port: FlowPort) => void;
}) => {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("bottom");
  const [custom, setCustom] = useState<At>([0.5, 0.5]);
  const clean = name.trim();
  const add = () => {
    if (!clean || taken(clean)) {
      return;
    }
    onAdd({
      name: clean,
      at: position === "custom" ? custom : [...SIDES[position]],
    });
    setName("");
  };
  return (
    <div className="flow__port" data-testid="flow-port-add">
      <input
        className="flow__input"
        data-testid="flow-port-add-name"
        aria-label={t("labels.flow.selection.portName")}
        placeholder={t("labels.flow.selection.portName")}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            add();
          }
        }}
      />
      <PositionSelect
        value={position}
        onChange={setPosition}
        testId="flow-port-add-position"
      />
      {position === "custom" && (
        <PercentPills
          at={custom}
          onChange={setCustom}
          testId="flow-port-add-at"
        />
      )}
      <button
        type="button"
        className="inspector__action"
        data-testid="flow-port-add-button"
        disabled={!clean || taken(clean)}
        onClick={add}
      >
        {t("labels.flow.selection.addPort")}
      </button>
    </div>
  );
};

/** a step's ports: rename, move, remove, add, or take a ready-made set; links follow */
export const FlowPortsEditor = ({
  app,
  step,
  onChange,
}: {
  app: App;
  step: Step;
  onChange: () => void;
}) => {
  const ports = stepPortsOf(step.element);
  const write = (
    next: readonly FlowPort[] | null,
    renames?: Map<string, string>,
  ) => {
    setStepPorts(app.scene, step.flowId, step.key, next, renames);
    onChange();
  };
  const edit = (index: number, port: FlowPort) =>
    write(
      ports.map((entry, at) => (at === index ? port : entry)),
      port.name === ports[index].name
        ? undefined
        : new Map([[ports[index].name, port.name]]),
    );
  const taken = (name: string, except = -1) =>
    ports.some((port, index) => index !== except && port.name === name);

  return (
    <div data-testid="flow-ports-editor">
      <div className="inspector__hint">
        {t("labels.flow.selection.portsHint")}
      </div>
      {ports.map((port, index) => (
        <div
          className="flow__port"
          key={index}
          data-testid={`flow-port-row-${index}`}
        >
          <input
            key={port.name}
            className="flow__input"
            data-testid={`flow-port-name-${index}`}
            aria-label={t("labels.flow.selection.portName")}
            defaultValue={port.name}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (!name || taken(name, index)) {
                event.target.value = port.name;
              } else if (name !== port.name) {
                edit(index, { ...port, name });
              }
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                (event.target as HTMLInputElement).blur();
              }
            }}
          />
          <PositionSelect
            value={positionOf(port.at)}
            testId={`flow-port-position-${index}`}
            onChange={(position) =>
              position !== "custom" &&
              edit(index, { ...port, at: [...SIDES[position]] })
            }
          />
          <PercentPills
            at={port.at}
            testId={`flow-port-at-${index}`}
            onChange={(at) => edit(index, { ...port, at })}
          />
          <button
            type="button"
            className="inspector__action"
            data-testid={`flow-port-remove-${index}`}
            aria-label={t("labels.flow.selection.removePort")}
            title={t("labels.flow.selection.removePort")}
            onClick={() => write(ports.filter((_, at) => at !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <AddPort taken={taken} onAdd={(port) => write([...ports, port])} />
      <div className="flow__port-presets">
        {(["decision", "fork"] as const).map((preset) => (
          <button
            key={preset}
            type="button"
            className="inspector__action"
            data-testid={`flow-ports-${preset}`}
            onClick={() => write(PORT_PRESETS[preset])}
          >
            {t(`labels.flow.selection.${preset}`)}
          </button>
        ))}
        <button
          type="button"
          className="inspector__action"
          data-testid="flow-ports-reset"
          onClick={() => write(null)}
        >
          {t("labels.flow.selection.resetPorts")}
        </button>
      </div>
    </div>
  );
};
