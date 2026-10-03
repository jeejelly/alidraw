import { useState } from "react";

import { actionVectorizeImage } from "../../../actions/actionVectorizeImage";
import { t } from "../../../i18n";
import { Section, SliderRow } from "../primitives";

import type App from "../../App";

/** Trace the selected picture into vector shapes (palette size and smoothing). */
export const VectorizeSection = ({ app }: { app: App }) => {
  const [colors, setColors] = useState(12);
  const [smoothing, setSmoothing] = useState(40);
  const images = app.scene
    .getSelectedElements(app.state)
    .filter((element) => element.type === "image");
  if (!images.length) {
    return null;
  }
  return (
    <Section title={t("labels.vectorize.title")} testId="inspector-vectorize">
      <SliderRow
        label={t("labels.vectorize.colors")}
        value={colors}
        min={2}
        max={32}
        onChange={setColors}
        testId="vectorize-colors"
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
      <button
        type="button"
        className="inspector__action"
        data-testid="vectorize-run"
        title={t("labels.vectorize.hint")}
        onClick={() =>
          app.actionManager.executeAction(actionVectorizeImage, "ui", {
            colors,
            smoothing: smoothing / 100,
          })
        }
      >
        {t("labels.vectorizeImage")}
      </button>
      <div className="inspector__hint">{t("labels.vectorize.hint")}</div>
    </Section>
  );
};
