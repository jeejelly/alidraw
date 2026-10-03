import { isPathfinderOperand } from "@excalidraw/element";

import {
  PATHFINDER_ACTIONS,
  actionMakeCompoundShape,
  actionReleaseCompoundShape,
} from "../../../actions";
import { t } from "../../../i18n";
import { PathfinderIcon } from "../PathfinderIcons";
import { Section } from "../primitives";

import type App from "../../App";

/** Boolean operations on the selected closed shapes. */
export const PathfinderSection = ({ app }: { app: App }) => {
  const selected = app.scene.getSelectedElements(app.state);
  const ready = selected.length >= 2 && selected.every(isPathfinderOperand);
  return (
    <Section title={t("labels.pathfinder.title")} testId="inspector-pathfinder">
      <div className="inspector__row" style={{ gap: 2 }}>
        {PATHFINDER_ACTIONS.map(([operation, action]) => (
          <button
            key={operation}
            type="button"
            className="inspector__iconbtn"
            style={{ width: "2rem", fontSize: "1rem" }}
            data-testid={`pathfinder-${operation}`}
            title={t(`labels.pathfinder.${operation}` as any)}
            disabled={!ready}
            onClick={() => app.actionManager.executeAction(action, "ui")}
          >
            <PathfinderIcon op={operation} />
          </button>
        ))}
        <button
          type="button"
          className="inspector__iconbtn"
          style={{ width: "2rem", fontSize: "1rem" }}
          data-testid="pathfinder-compound"
          title={`${t("labels.pathfinder.compound")} (Ctrl+8)`}
          disabled={!ready}
          onClick={() =>
            app.actionManager.executeAction(actionMakeCompoundShape, "ui")
          }
        >
          <PathfinderIcon op="compound" />
        </button>
        <button
          type="button"
          className="inspector__iconbtn"
          style={{ width: "2rem", fontSize: "1rem" }}
          data-testid="pathfinder-release"
          title={`${t("labels.pathfinder.release")} (Ctrl+Alt+8)`}
          disabled={
            !selected.some(
              (element) => element.type === "path" && element.contours?.length,
            )
          }
          onClick={() =>
            app.actionManager.executeAction(actionReleaseCompoundShape, "ui")
          }
        >
          <PathfinderIcon op="release" />
        </button>
      </div>
    </Section>
  );
};
