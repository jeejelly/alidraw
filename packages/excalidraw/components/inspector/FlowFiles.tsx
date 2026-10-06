import { useState } from "react";

import {
  exportFlowAsMermaid,
  exportFlows,
  flowsFromDocument,
  importFlows,
} from "@excalidraw/flow";
import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import { fileOpen, fileSave } from "../../data/filesystem";
import { t } from "../../i18n";

import type App from "../App";

const readText = (file: File) =>
  typeof file.text === "function"
    ? file.text()
    : new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });

const ABORTED = "AbortError";

/** Import and export of flows as Markdown or Mermaid files. */
export const FlowFiles = ({
  app,
  flowId,
  allFlows,
  onImported,
}: {
  app: App;
  flowId: string | null;
  allFlows: readonly string[];
  onImported: (flowId: string) => void;
}) => {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const importFile = async () => {
    try {
      const file = await fileOpen({
        description: t("labels.flow.import"),
        extensions: ["md", "mmd"],
      });
      const sources = flowsFromDocument(await readText(file), file.name);
      if (!sources.length) {
        setMessage(t("labels.flow.nothingToImport", { name: file.name }));
        return;
      }
      const origin = viewportCoordsToSceneCoords(
        {
          clientX: app.state.offsetLeft + 80,
          clientY: app.state.offsetTop + 120,
        },
        app.state,
      );
      const report = importFlows(app.scene, sources, origin);
      for (const id of report.imported) {
        app.layers.assignFlow(id);
      }
      app.store.scheduleCapture();
      app.setState({});
      const problem = report.problems[0];
      setMessage(
        problem
          ? `${problem.name}: ${problem.issues[0].message}`
          : t("labels.flow.imported", { count: report.imported.length }),
      );
      if (report.imported.length) {
        onImported(report.imported[0]);
      }
    } catch (error: any) {
      if (error?.name !== ABORTED) {
        setMessage(error?.message ?? String(error));
      }
    }
  };

  const save = async (name: string, extension: "md" | "mmd", text: string) => {
    try {
      await fileSave(new Blob([text], { type: "text/plain" }), {
        name,
        extension,
        description: t("labels.flow.export"),
      });
      setMessage(t("labels.flow.exported", { name: `${name}.${extension}` }));
    } catch (error: any) {
      if (error?.name !== ABORTED) {
        setMessage(error?.message ?? String(error));
      }
    }
    setExporting(false);
  };

  return (
    <div className="flow__files" data-testid="flow-files">
      <div className="flow__actions">
        <button
          type="button"
          className="flow__btn"
          data-testid="flow-import"
          title={t("labels.flow.importHint")}
          onClick={importFile}
        >
          {t("labels.flow.import")}
        </button>
        <button
          type="button"
          className="flow__btn"
          data-testid="flow-export"
          aria-expanded={exporting}
          disabled={!allFlows.length}
          onClick={() => setExporting((open) => !open)}
        >
          {t("labels.flow.export")}
        </button>
      </div>
      {exporting && (
        <div className="flow__actions">
          <button
            type="button"
            className="flow__btn"
            data-testid="flow-export-markdown"
            onClick={() =>
              save("flows", "md", exportFlows(app.scene, allFlows))
            }
          >
            {t("labels.flow.exportMarkdown")}
          </button>
          <button
            type="button"
            className="flow__btn"
            data-testid="flow-export-mermaid"
            disabled={!flowId}
            onClick={() =>
              flowId &&
              save(flowId, "mmd", exportFlowAsMermaid(app.scene, flowId))
            }
          >
            {t("labels.flow.exportMermaid")}
          </button>
        </div>
      )}
      {message && (
        <div className="inspector__hint" data-testid="flow-files-message">
          {message}
        </div>
      )}
    </div>
  );
};
