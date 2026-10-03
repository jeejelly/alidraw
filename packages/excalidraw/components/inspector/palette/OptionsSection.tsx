import { t } from "../../../i18n";
import { Section } from "../primitives";

import type { getShapeActionPredicates } from "../../shapeActionPredicates";

import type App from "../../App";

/** Everything the classic panel offers that the other sections do not. */
export const OptionsSection = ({
  app,
  predicates,
}: {
  app: App;
  predicates: ReturnType<typeof getShapeActionPredicates>;
}) => {
  const { actionManager } = app;
  return (
    <Section title={t("labels.palette.options")} testId="inspector-options">
      <div className="selected-shape-actions">
        {predicates.fill && actionManager.renderAction("changeFillStyle")}
        {predicates.freedrawMode &&
          actionManager.renderAction("changeFreedrawMode")}
        {predicates.roundness && actionManager.renderAction("changeRoundness")}
        {predicates.arrowType && actionManager.renderAction("changeArrowType")}
        {predicates.arrowheads && actionManager.renderAction("changeArrowhead")}
        {predicates.verticalAlign &&
          actionManager.renderAction("changeVerticalAlign")}
        {predicates.showExtraActions && (
          <fieldset>
            <legend>{t("labels.actions")}</legend>
            <div className="buttonList">
              {actionManager.renderAction("duplicateSelection")}
              {actionManager.renderAction("deleteSelectedElements")}
              {actionManager.renderAction("group")}
              {actionManager.renderAction("ungroup")}
              {predicates.link && actionManager.renderAction("hyperlink")}
              {predicates.cropEditor &&
                actionManager.renderAction("cropEditor")}
              {predicates.lineEditor &&
                actionManager.renderAction("toggleLinearEditor")}
            </div>
          </fieldset>
        )}
      </div>
    </Section>
  );
};
