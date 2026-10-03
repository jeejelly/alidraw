import {
  actionConvertShapeToPath,
  actionEditPath,
  actionJoinPaths,
} from "../../../actions";
import { t } from "../../../i18n";
import { PathActionIcon } from "../PathfinderIcons";
import { Section } from "../primitives";

import type App from "../../App";

type PathButton = {
  id: string;
  icon: React.ReactNode;
  title: string;
  enabled: boolean;
  active: boolean;
  run: () => void;
};

/** Path tools one click away (the toolbar keeps them in its overflow menu). */
export const PathSection = ({ app }: { app: App }) => {
  const selected = app.scene.getSelectedElements(app.state);
  const execute = (action: any) =>
    app.actionManager.executeAction(action, "ui");
  const canConvert = actionConvertShapeToPath.predicate?.(
    app.scene.getElementsIncludingDeleted(),
    app.state,
    app.props,
    app,
  );
  const canEdit =
    !app.state.editingPath &&
    selected.length === 1 &&
    selected[0].type === "path";
  const buttons: PathButton[] = [
    {
      id: "path-edit",
      icon: <PathActionIcon kind="edit" />,
      title: t("labels.path.edit"),
      enabled: canEdit,
      active: !!app.state.editingPath,
      run: () => execute(actionEditPath),
    },
    {
      id: "path-convert",
      icon: <PathActionIcon kind="convert" />,
      title: t("labels.path.convertToPath"),
      enabled: !!canConvert,
      active: false,
      run: () => execute(actionConvertShapeToPath),
    },
    {
      id: "path-join",
      icon: <PathActionIcon kind="join" />,
      title: t("labels.path.join"),
      enabled:
        selected.length === 2 &&
        selected.every((element) => element.type === "path"),
      active: false,
      run: () => execute(actionJoinPaths),
    },
  ];
  return (
    <Section title={t("labels.path.title")} testId="inspector-path">
      <div className="inspector__row" style={{ gap: 2 }}>
        {buttons.map(({ id, icon, title, enabled, active, run }) => (
          <button
            key={id}
            type="button"
            className="inspector__iconbtn"
            style={{ width: "2rem", height: "2rem" }}
            data-testid={id}
            title={title}
            aria-pressed={active}
            disabled={!enabled}
            onClick={run}
          >
            {icon}
          </button>
        ))}
      </div>
    </Section>
  );
};
