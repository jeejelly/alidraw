import { flowSelectionOf } from "@excalidraw/flow";

import { t } from "../../i18n";

import { FlowLinkEditor } from "./FlowLinkEditor";
import { FlowPortsEditor } from "./FlowPortsEditor";
import { Section } from "./primitives";

import type App from "../App";

/** the controls of the selected step (its ports) or link (ends, line, route, ports, label) */
export const FlowSelection = ({ app }: { app: App }) => {
  const selection = flowSelectionOf(
    app.scene.getElementsIncludingDeleted(),
    app.scene.getSelectedElements(app.state),
  );
  if (!selection) {
    return null;
  }
  const commit = () => {
    app.store.scheduleCapture();
    app.setState({});
  };
  return (
    <Section title={t("labels.flow.selection.title")} testId="flow-selection">
      {selection.kind === "step" ? (
        <FlowPortsEditor app={app} step={selection} onChange={commit} />
      ) : (
        <FlowLinkEditor app={app} link={selection} onChange={commit} />
      )}
    </Section>
  );
};
