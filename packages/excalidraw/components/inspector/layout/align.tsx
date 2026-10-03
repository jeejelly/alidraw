import {
  actionAlignBottom,
  actionAlignHorizontallyCentered,
  actionAlignLeft,
  actionAlignRight,
  actionAlignTop,
  actionAlignVerticallyCentered,
  distributeHorizontally,
  distributeVertically,
} from "../../../actions";
import { t } from "../../../i18n";
import {
  AlignLeftIcon,
  CenterHorizontallyIcon,
  AlignRightIcon,
  AlignTopIcon,
  CenterVerticallyIcon,
  AlignBottomIcon,
  DistributeHorizontallyIcon,
  DistributeVerticallyIcon,
} from "../../icons";
import { Section } from "../primitives";

import type App from "../../App";

// built on use: the actions module is still loading when this file is first read
const getAligners = () =>
  [
    [actionAlignLeft, AlignLeftIcon, "labels.alignLeft"],
    [
      actionAlignHorizontallyCentered,
      CenterHorizontallyIcon,
      "labels.centerHorizontally",
    ],
    [actionAlignRight, AlignRightIcon, "labels.alignRight"],
    [actionAlignTop, AlignTopIcon, "labels.alignTop"],
    [
      actionAlignVerticallyCentered,
      CenterVerticallyIcon,
      "labels.centerVertically",
    ],
    [actionAlignBottom, AlignBottomIcon, "labels.alignBottom"],
    [
      distributeHorizontally,
      DistributeHorizontallyIcon,
      "labels.distributeHorizontally",
    ],
    [
      distributeVertically,
      DistributeVerticallyIcon,
      "labels.distributeVertically",
    ],
  ] as const;

/** Six alignments and two distributions (which need 3+ elements). */
export const AlignSection = ({ app }: { app: App }) => {
  const count = app.scene.getSelectedElements(app.state).length;
  return (
    <Section title={t("labels.alignPanel.title")} testId="inspector-align">
      <div className="inspector__row" style={{ gap: 2, flexWrap: "wrap" }}>
        {getAligners().map(([action, icon, label]) => (
          <button
            key={label}
            type="button"
            className="inspector__iconbtn"
            style={{ width: "2rem", height: "2rem" }}
            data-testid={`align-${label.split(".")[1]}`}
            title={t(label)}
            disabled={count < (label.includes("distribute") ? 3 : 2)}
            onClick={() => app.actionManager.executeAction(action, "ui")}
          >
            {icon}
          </button>
        ))}
      </div>
    </Section>
  );
};
