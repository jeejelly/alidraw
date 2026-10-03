import {
  addSwatches,
  parsePaletteFile,
  serializeAse,
  serializeGpl,
} from "@excalidraw/color";

import type { Swatch } from "@excalidraw/color";

import { t } from "../../../i18n";

/** Downloads the swatches as a palette file other tools read. */
export const downloadSwatches = (
  swatches: readonly Swatch[],
  format: "gpl" | "ase",
) => {
  const colors = swatches.map(({ name, color }) => ({ name, color }));
  const blob = new Blob(
    [
      format === "gpl"
        ? serializeGpl(colors, "Swatches")
        : serializeAse(colors),
    ],
    { type: "application/octet-stream" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `swatches.${format}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `${colors.length} swatches exported.`;
};

/** Imports a palette file; returns the status message to show. */
export const importSwatches = async (file: File) => {
  const colors = await parsePaletteFile(file);
  const added = colors.length ? addSwatches(colors) : 0;
  return colors.length
    ? t("labels.palette.imported", { count: added })
    : t("labels.palette.importFailed");
};
