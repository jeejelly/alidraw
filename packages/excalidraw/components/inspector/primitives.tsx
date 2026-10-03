import { useEffect, useState } from "react";

import type { ReactNode } from "react";

export const Section = ({
  title,
  hint,
  children,
  testId,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  testId?: string;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <section className="inspector__section" data-testid={testId}>
      <button
        type="button"
        className="inspector__title"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span>{title}</span>
        <span>{hint ?? (open ? "−" : "+")}</span>
      </button>
      {open && children}
    </section>
  );
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const parse = (raw: string) => {
  const parsed = Number(raw.trim().replace(",", "."));
  return raw.trim() && Number.isFinite(parsed) ? parsed : null;
};

/** an editable number in a pill; arrows step, Shift steps by ten */
export const NumberPill = ({
  value,
  min,
  max,
  step = 1,
  unit,
  onCommit,
  disabled,
  testId,
  label,
}: {
  value: number | null;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onCommit: (value: number) => void;
  disabled?: boolean;
  testId?: string;
  label: string;
}) => {
  const show = (nextValue: number | null) =>
    nextValue === null ? "" : `${Math.round(nextValue * 100) / 100}`;
  const [draft, setDraft] = useState(show(value));
  useEffect(() => setDraft(show(value)), [value]);

  const commit = () => {
    const parsed = parse(draft);
    if (parsed === null) {
      setDraft(show(value));
    } else if (parsed !== value) {
      onCommit(clamp(parsed, min, max));
    }
  };

  return (
    <label className="inspector__pill">
      <input
        type="text"
        inputMode="decimal"
        data-testid={testId}
        aria-label={label}
        disabled={disabled}
        placeholder="—"
        value={draft}
        onChange={(changeEvent) => setDraft(changeEvent.target.value)}
        onBlur={commit}
        onKeyDown={(keyEvent) => {
          keyEvent.stopPropagation();
          if (keyEvent.key === "Enter") {
            commit();
          } else if (
            keyEvent.key === "ArrowUp" ||
            keyEvent.key === "ArrowDown"
          ) {
            keyEvent.preventDefault();
            const base = parse(draft) ?? value ?? min;
            const delta =
              (keyEvent.key === "ArrowUp" ? 1 : -1) *
              step *
              (keyEvent.shiftKey ? 10 : 1);
            const next = clamp(
              Math.round((base + delta) * 1000) / 1000,
              min,
              max,
            );
            setDraft(show(next));
            onCommit(next);
          }
        }}
      />
      {unit && <span>{unit}</span>}
    </label>
  );
};

/** label + slider + value pill: every numeric style uses this one row */
export const SliderRow = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  testId: string;
}) => {
  const shown = value ?? min;
  return (
    <div className="inspector__row">
      <span className="inspector__label">{label}</span>
      <input
        type="range"
        className="inspector__slider"
        data-testid={`${testId}-slider`}
        aria-label={label}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={clamp(shown, min, max)}
        style={{
          ["--p" as string]: (clamp(shown, min, max) - min) / (max - min),
        }}
        onChange={(changeEvent) => onChange(+changeEvent.target.value)}
      />
      <NumberPill
        label={label}
        testId={`${testId}-value`}
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        disabled={disabled}
        onCommit={onChange}
      />
    </div>
  );
};

/** a pill-shaped segmented choice */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string;
  options: readonly { value: T; text: string; title?: string }[];
  value: T | null;
  onChange: (selected: T) => void;
  testId: string;
}) {
  return (
    <div className="inspector__row">
      <span className="inspector__label">{label}</span>
      <div className="inspector__seg" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.title}
            data-testid={`${testId}-${option.value}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
  );
}
