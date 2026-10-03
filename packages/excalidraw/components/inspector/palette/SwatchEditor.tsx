import { removeSwatch, renameSwatch, setSwatchColor } from "@excalidraw/color";

import type { Swatch } from "@excalidraw/color";

import { t } from "../../../i18n";
import { ColorField } from "../ColorField";

import { blurOnEnter } from "./inputHandlers";
import { SwatchIcon } from "./SwatchIcon";

export const SwatchEditor = ({
  swatch,
  onRemoved,
}: {
  swatch: Swatch;
  onRemoved: () => void;
}) => (
  <div className="inspector__swatch-editor" data-testid="palette-swatch-editor">
    <ColorField
      value={swatch.color}
      testId="palette-swatch-hex"
      label={t("labels.palette.pick")}
      onChange={(color) => setSwatchColor(swatch.id, color)}
    />
    <div className="inspector__row" style={{ marginTop: 0 }}>
      <input
        className="inspector__text"
        data-testid="palette-swatch-name"
        key={swatch.id}
        defaultValue={swatch.name}
        onBlur={(event) => renameSwatch(swatch.id, event.target.value)}
        onKeyDown={blurOnEnter}
      />
      <button
        type="button"
        className="inspector__iconbtn inspector__iconbtn--lg"
        data-testid="palette-swatch-remove"
        aria-label={t("labels.palette.remove")}
        title={t("labels.palette.remove")}
        onClick={() => {
          removeSwatch(swatch.id);
          onRemoved();
        }}
      >
        <SwatchIcon kind="trash" />
      </button>
    </div>
  </div>
);
