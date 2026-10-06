import { useState } from "react";

import { TRACE_PRESETS } from "@excalidraw/vector";

import { actionVectorizeImage } from "../../../actions/actionVectorizeImage";
import { t } from "../../../i18n";
import { Section, Segmented, SliderRow } from "../primitives";

import type App from "../../App";

type Preset = keyof typeof TRACE_PRESETS;
type Flag = "on" | "off";

const flag = (value: boolean): Flag => (value ? "on" : "off");

/** Trace the selected picture into vector shapes: for artwork, or for a screen capture (shapes, text blocks, library icons). */
export const VectorizeSection = ({ app }: { app: App }) => {
  const [preset, setPreset] = useState<Preset>("ui");
  const [colors, setColors] = useState<number>(TRACE_PRESETS.ui.colors);
  const [smoothing, setSmoothing] = useState(TRACE_PRESETS.ui.smoothing * 100);
  // 100 keeps every speck of detail
  const [detail, setDetail] = useState(90);
  const [shapes, setShapes] = useState<boolean>(TRACE_PRESETS.ui.shapes);
  const [text, setText] = useState<boolean>(TRACE_PRESETS.ui.text);
  const [icons, setIcons] = useState(true);
  const images = app.scene
    .getSelectedElements(app.state)
    .filter((element) => element.type === "image");
  if (!images.length) {
    return null;
  }
  const choose = (next: Preset) => {
    const values = TRACE_PRESETS[next];
    setPreset(next);
    setColors(values.colors);
    setSmoothing(values.smoothing * 100);
    setDetail(next === "ui" ? 90 : 60);
    setShapes(values.shapes);
    setText(values.text);
    setIcons(next === "ui");
  };
  return (
    <Section title={t("labels.vectorize.title")} testId="inspector-vectorize">
      <Segmented<Preset>
        label={t("labels.vectorize.preset")}
        value={preset}
        onChange={choose}
        testId="vectorize-preset"
        options={[
          {
            value: "ui",
            text: t("labels.vectorize.presetUi"),
            title: t("labels.vectorize.presetUiHint"),
          },
          {
            value: "art",
            text: t("labels.vectorize.presetArt"),
            title: t("labels.vectorize.presetArtHint"),
          },
        ]}
      />
      <SliderRow
        label={t("labels.vectorize.colors")}
        value={colors}
        min={2}
        max={64}
        onChange={setColors}
        testId="vectorize-colors"
      />
      <SliderRow
        label={t("labels.vectorize.detail")}
        value={detail}
        min={0}
        max={100}
        unit="%"
        onChange={setDetail}
        testId="vectorize-detail"
      />
      <SliderRow
        label={t("labels.vectorize.smoothing")}
        value={smoothing}
        min={0}
        max={100}
        unit="%"
        onChange={setSmoothing}
        testId="vectorize-smoothing"
      />
      <Segmented<Flag>
        label={t("labels.vectorize.shapes")}
        value={flag(shapes)}
        onChange={(next) => setShapes(next === "on")}
        testId="vectorize-shapes"
        options={[
          {
            value: "on",
            text: t("labels.vectorize.on"),
            title: t("labels.vectorize.shapesHint"),
          },
          { value: "off", text: t("labels.vectorize.off") },
        ]}
      />
      <Segmented<Flag>
        label={t("labels.vectorize.text")}
        value={flag(text)}
        onChange={(next) => setText(next === "on")}
        testId="vectorize-text"
        options={[
          {
            value: "on",
            text: t("labels.vectorize.on"),
            title: t("labels.vectorize.textHint"),
          },
          { value: "off", text: t("labels.vectorize.off") },
        ]}
      />
      <Segmented<Flag>
        label={t("labels.vectorize.icons")}
        value={flag(icons)}
        onChange={(next) => setIcons(next === "on")}
        testId="vectorize-icons"
        options={[
          {
            value: "on",
            text: t("labels.vectorize.on"),
            title: t("labels.vectorize.iconsHint"),
          },
          { value: "off", text: t("labels.vectorize.off") },
        ]}
      />
      <button
        type="button"
        className="inspector__action"
        data-testid="vectorize-run"
        title={t("labels.vectorize.hint")}
        onClick={() =>
          app.actionManager.executeAction(actionVectorizeImage, "ui", {
            colors,
            smoothing: smoothing / 100,
            // full detail keeps single pixels, none drops areas up to 12 pixels across
            speckle: Math.round(((100 - detail) / 100) * 12 * 3),
            corner: TRACE_PRESETS[preset].corner,
            shapes,
            text,
            icons,
          })
        }
      >
        {t("labels.vectorizeImage")}
      </button>
      <div className="inspector__hint">{t("labels.vectorize.hint")}</div>
    </Section>
  );
};
