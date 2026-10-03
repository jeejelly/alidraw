import { normalizeHex } from "@excalidraw/color";

/** A colour square that opens the system picker, with its hex value beside it. */
export const ColorField = ({
  value,
  onChange,
  testId,
  label,
  compact,
}: {
  value: string;
  onChange: (hex: string) => void;
  testId?: string;
  label?: string;
  compact?: boolean;
}) => {
  const hex = normalizeHex(value) ?? "#000000";
  return (
    <div className={`inspector__colorfield${compact ? " is-compact" : ""}`}>
      <input
        type="color"
        className="inspector__colorfield-square"
        data-testid={testId ? `${testId}-picker` : undefined}
        aria-label={label ?? "Pick a colour"}
        title={label}
        value={hex}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
      />
      <input
        className="inspector__text inspector__colorfield-hex"
        data-testid={testId}
        aria-label={label ? `${label} (hex)` : "Hex"}
        key={hex}
        defaultValue={hex}
        spellCheck={false}
        onKeyDown={(keyEvent) => {
          keyEvent.stopPropagation();
          if (keyEvent.key === "Enter") {
            (keyEvent.target as HTMLInputElement).blur();
          }
        }}
        onBlur={(blurEvent) => {
          const normalized = normalizeHex(blurEvent.target.value);
          if (normalized && normalized !== hex) {
            onChange(normalized);
          } else {
            blurEvent.target.value = hex;
          }
        }}
      />
    </div>
  );
};
