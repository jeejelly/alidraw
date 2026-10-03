import {
  actionChangeSloppiness,
  actionChangeStrokeStyle,
  actionChangeStrokeWidthValue,
} from "../../../actions";
import { t } from "../../../i18n";
import { Section, Segmented, SliderRow } from "../primitives";

import type { RunAction } from "./types";

import type App from "../../App";

export const StrokeSection = ({ app, run }: { app: App; run: RunAction }) => {
  const first = app.scene.getSelectedElements(app.state)[0];
  return (
    <Section title={t("labels.stroke")} testId="inspector-stroke">
      <SliderRow
        label={t("labels.strokeWidth")}
        testId="inspector-stroke-width"
        value={first?.strokeWidth ?? null}
        min={0.5}
        max={20}
        step={0.5}
        unit="px"
        disabled={!first}
        onChange={(value) => run(actionChangeStrokeWidthValue, value)}
      />
      <Segmented
        label={t("labels.strokeStyle")}
        testId="inspector-stroke-style"
        value={first?.strokeStyle ?? app.state.currentItemStrokeStyle}
        options={[
          { value: "solid", text: "—", title: t("labels.strokeStyle_solid") },
          {
            value: "dashed",
            text: "- -",
            title: t("labels.strokeStyle_dashed"),
          },
          {
            value: "dotted",
            text: "···",
            title: t("labels.strokeStyle_dotted"),
          },
        ]}
        onChange={(value) => run(actionChangeStrokeStyle, value)}
      />
      <Segmented
        label={t("labels.sloppiness")}
        testId="inspector-roughness"
        value={first?.roughness ?? app.state.currentItemRoughness}
        options={[
          { value: 0, text: "0", title: t("labels.architect") },
          { value: 1, text: "1", title: t("labels.artist") },
          { value: 2, text: "2", title: t("labels.cartoonist") },
        ]}
        onChange={(value) => run(actionChangeSloppiness, value)}
      />
    </Section>
  );
};
