import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

const RGB = /^#[0-9a-f]{6}/i;

/** The colour part the square can show; `transparent` and named colours start from black. */
const rgbOf = (color: string | null) =>
  (color && RGB.exec(color)?.[0].toLowerCase()) || "#000000";

/** The alpha a hex colour carries (`#rrggbbaa`), kept across a pick in the square. */
const alphaOf = (color: string | null) =>
  color && /^#[0-9a-f]{8}$/i.test(color) ? color.slice(7) : "";

/**
 * Saturation/brightness square and hue bar, for any colour the palette does not hold.
 *
 * While the pointer drags (or a key is held) every move is a preview; releasing it commits the
 * last colour once, so a drag is one change and one undo step.
 */
export const ColorSpectrum = ({
  color,
  onPreview,
  onChange,
}: {
  color: string | null;
  onPreview?: (color: string) => void;
  onChange: (color: string) => void;
}) => {
  const [shown, setShown] = useState(rgbOf(color));
  const pending = useRef<string | null>(null);
  const alpha = alphaOf(color);

  useEffect(() => {
    if (pending.current === null) {
      setShown(rgbOf(color));
    }
  }, [color]);

  const commit = () => {
    if (pending.current !== null) {
      const picked = pending.current;
      pending.current = null;
      onChange(picked);
    }
  };

  // the pointer may be released outside the square while dragging
  useEffect(() => {
    window.addEventListener("pointerup", commit);
    return () => window.removeEventListener("pointerup", commit);
  });

  return (
    <div className="color-picker__spectrum" onKeyUp={commit}>
      <HexColorPicker
        color={shown}
        onChange={(rgb) => {
          setShown(rgb);
          pending.current = rgb + alpha;
          (onPreview ?? (() => {}))(pending.current);
        }}
      />
    </div>
  );
};
