import { useRef, useState } from "react";

import { addSwatch, addSwatches, moveSwatch } from "@excalidraw/color";

import type { Swatch } from "@excalidraw/color";

import { t } from "../../../i18n";
import { ColorHarmony } from "../ColorHarmony";
import { Section } from "../primitives";

import { downloadSwatches, importSwatches } from "./swatchFiles";
import { SwatchEditor } from "./SwatchEditor";
import { SwatchIcon } from "./SwatchIcon";

import type App from "../../App";

const SWATCH_BUTTON = "inspector__iconbtn inspector__iconbtn--lg";

export const SwatchesSection = ({
  app,
  swatches,
  hex,
  applyColor,
}: {
  app: App;
  swatches: readonly Swatch[];
  hex: string | null;
  applyColor: (color: string) => unknown;
}) => {
  const [managing, setManaging] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [harmonyOpen, setHarmonyOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editSwatch =
    swatches.find((swatch) => swatch.id === editId) ?? swatches[0] ?? null;

  return (
    <Section
      title={t("labels.palette.swatches")}
      hint={`${swatches.length}`}
      testId="inspector-swatches"
    >
      <div
        data-testid="palette-swatches"
        className="inspector__swatches"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          // dropped on the empty part: to the end of the list
          const id = event.dataTransfer.getData("text/swatch-id");
          if (id) {
            moveSwatch(id, null);
          }
        }}
      >
        {swatches.length === 0 && (
          <span className="inspector__hint">{t("labels.palette.empty")}</span>
        )}
        {swatches.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            draggable
            className={`inspector__swatch${
              managing && editSwatch?.id === swatch.id ? " is-picked" : ""
            }`}
            data-testid="palette-swatch"
            title={`${swatch.name} ${swatch.color}`}
            style={{ background: swatch.color }}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/swatch-id", swatch.id);
              event.dataTransfer.setData("text/swatch-color", swatch.color);
              event.dataTransfer.effectAllowed = "copyMove";
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.stopPropagation();
              const id = event.dataTransfer.getData("text/swatch-id");
              if (id) {
                moveSwatch(id, swatch.id);
              }
            }}
            onClick={() =>
              managing ? setEditId(swatch.id) : applyColor(swatch.color)
            }
          />
        ))}
      </div>
      {managing && editSwatch && (
        <SwatchEditor swatch={editSwatch} onRemoved={() => setEditId(null)} />
      )}
      <div className="inspector__row">
        <button
          type="button"
          className={SWATCH_BUTTON}
          data-testid="palette-add"
          title={t("labels.palette.add")}
          aria-label={t("labels.palette.add")}
          disabled={!hex}
          onClick={() => {
            const added = hex && addSwatch(hex);
            if (added) {
              setManaging(true);
              setEditId(added.id);
            }
          }}
        >
          <SwatchIcon kind="plus" />
        </button>
        <button
          type="button"
          className={SWATCH_BUTTON}
          data-testid="palette-manage"
          aria-pressed={managing}
          title={managing ? t("labels.palette.done") : t("labels.palette.edit")}
          aria-label={
            managing ? t("labels.palette.done") : t("labels.palette.edit")
          }
          onClick={() => setManaging((current) => !current)}
        >
          <SwatchIcon kind="pencil" />
        </button>
        <button
          type="button"
          className={SWATCH_BUTTON}
          data-testid="palette-import"
          title={t("labels.palette.import")}
          aria-label={t("labels.palette.import")}
          onClick={() => fileRef.current?.click()}
        >
          <SwatchIcon kind="upload" />
        </button>
        <button
          type="button"
          className={SWATCH_BUTTON}
          data-testid="palette-export"
          title="Export the swatches as .gpl"
          aria-label="Export the swatches as .gpl"
          disabled={swatches.length === 0}
          onClick={() => setMessage(downloadSwatches(swatches, "gpl"))}
        >
          <SwatchIcon kind="download" />
        </button>
        <button
          type="button"
          className={SWATCH_BUTTON}
          data-testid="palette-export-ase"
          title="Export the swatches as .ase"
          aria-label="Export the swatches as .ase"
          disabled={swatches.length === 0}
          onClick={() => setMessage(downloadSwatches(swatches, "ase"))}
        >
          <span style={{ fontSize: "0.6rem", fontWeight: 700 }}>ASE</span>
        </button>
        <button
          type="button"
          className={SWATCH_BUTTON}
          data-testid="palette-harmony"
          aria-pressed={harmonyOpen}
          title="Colour harmonies and palettes"
          aria-label="Colour harmonies and palettes"
          onClick={() => setHarmonyOpen((open) => !open)}
        >
          ◐
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".ase,.gpl"
          hidden
          data-testid="palette-import-input"
          onChange={async (event) => {
            const input = event.target;
            const file = input.files?.[0];
            input.value = "";
            if (file) {
              setMessage(await importSwatches(file));
            }
          }}
        />
        {message && (
          <span
            role="status"
            className="inspector__hint"
            style={{ padding: 0 }}
          >
            {message}
          </span>
        )}
      </div>
      {harmonyOpen && (
        <ColorHarmony
          app={app}
          initial={hex ?? "#4f8dff"}
          actions={[
            {
              id: "keep",
              label: "Keep in swatches",
              run: (colors) => {
                const count = addSwatches(
                  colors.map((color, index) => ({
                    name: `Harmony ${index + 1} ${color}`,
                    color,
                  })),
                );
                setMessage(`${count} colours added to the swatches.`);
              },
            },
            {
              id: "fill",
              label: "Use the base as fill",
              run: (_colors, base) => applyColor(base),
            },
          ]}
        />
      )}
    </Section>
  );
};
