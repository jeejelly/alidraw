import type { Param } from "@excalidraw/symbols";

export const ParamField = ({
  param,
  value,
  onChange,
}: {
  param: Param;
  value: any;
  onChange: (value: any) => void;
}) => (
  <label className="symbols__param">
    <span>{param.label}</span>
    {param.kind === "bool" ? (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(event) => onChange(event.target.checked)}
      />
    ) : param.kind === "choice" ? (
      <select
        className="inspector__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {param.options!.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : param.kind === "number" ? (
      <input
        type="number"
        className="inspector__text"
        min={param.min}
        max={param.max}
        value={value}
        onKeyDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          const number = Number(event.target.value);
          if (Number.isFinite(number)) {
            onChange(
              Math.min(
                param.max ?? number,
                Math.max(param.min ?? number, number),
              ),
            );
          }
        }}
      />
    ) : (
      <input
        type="text"
        className="inspector__text"
        value={value}
        onKeyDown={(event) => event.stopPropagation()}
        onChange={(event) => onChange(event.target.value)}
      />
    )}
  </label>
);
