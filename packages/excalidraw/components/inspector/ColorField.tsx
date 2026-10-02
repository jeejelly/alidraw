import { normalizeHex } from "../../palette";

/**
 * The one way to edit a colour in the palette: a square that opens the system
 * colour picker, and the hex value beside it. Used for swatches, theme colours
 * and the fill and stroke.
 */
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
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="inspector__text inspector__colorfield-hex"
        data-testid={testId}
        aria-label={label ? `${label} (hex)` : "Hex"}
        key={hex}
        defaultValue={hex}
        spellCheck={false}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={(e) => {
          const v = normalizeHex(e.target.value);
          if (v && v !== hex) {
            onChange(v);
          } else {
            e.target.value = hex;
          }
        }}
      />
    </div>
  );
};
