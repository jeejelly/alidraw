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
        onClick={() => setOpen((o) => !o)}
      >
        <span>{title}</span>
        <span>{hint ?? (open ? "−" : "+")}</span>
      </button>
      {open && children}
    </section>
  );
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const parse = (raw: string) => {
  const v = Number(raw.trim().replace(",", "."));
  return raw.trim() && Number.isFinite(v) ? v : null;
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
  const show = (v: number | null) =>
    v === null ? "" : `${Math.round(v * 100) / 100}`;
  const [draft, setDraft] = useState(show(value));
  useEffect(() => setDraft(show(value)), [value]);

  const commit = () => {
    const v = parse(draft);
    if (v === null) {
      setDraft(show(value));
    } else if (v !== value) {
      onCommit(clamp(v, min, max));
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
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            commit();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const base = parse(draft) ?? value ?? min;
            const d =
              (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            const next = clamp(Math.round((base + d) * 1000) / 1000, min, max);
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
        onChange={(e) => onChange(+e.target.value)}
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
  onChange: (v: T) => void;
  testId: string;
}) {
  return (
    <div className="inspector__row">
      <span className="inspector__label">{label}</span>
      <div className="inspector__seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            title={o.title}
            data-testid={`${testId}-${o.value}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}
