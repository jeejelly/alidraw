import { useEffect, useRef, useState } from "react";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import {
  adoptIntoFlow,
  applyFlow,
  getFlowMeta,
  listFlows,
  readFlow,
  renameFlow,
} from "@excalidraw/flow";
import { parseFlow, serializeFlow, type FlowIssue } from "@excalidraw/flow";
import { t } from "../../i18n";

import type App from "../App";

const STARTER = `flowchart TD
  subgraph home["Home screen"]
    buy["Buy button"]
  end
  subgraph cart["Cart screen"]
    pay["Pay"]
  end
  buy -->|"click"| pay
`;

const FlowGraphIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="12" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <path d="M8.2 7.2 15.8 10.8M8.2 16.8l7.6-3.6" />
  </svg>
);

const useSceneNonce = (app: App) => {
  const [, bump] = useState(0);
  useEffect(() => {
    const off = app.scene.onUpdate(() => bump((n) => n + 1));
    return () => {
      try {
        off();
      } catch {
        // the scene was destroyed first
      }
    };
  }, [app]);
};

/**
 * The Source view of a flow: Mermaid text on one side of the screen, the
 * diagram on the canvas on the other. Edit either, the other follows.
 */
export const FlowPanel = ({ app }: { app: App }) => {
  useSceneNonce(app);
  const elements = app.scene.getElementsIncludingDeleted();
  const flows = listFlows(elements);
  const selected = app.scene.getSelectedElements(app.state);
  const selectedFlow = selected.map(getFlowMeta).find(Boolean)?.id ?? null;

  const [chosen, setChosen] = useState<string | null>(null);
  const flowId =
    chosen && flows.includes(chosen)
      ? chosen
      : selectedFlow ?? flows[0] ?? null;

  const fromCanvas = flowId ? serializeFlow(readFlow(elements, flowId)) : "";
  const [draft, setDraft] = useState<string | null>(null);
  const [issues, setIssues] = useState<FlowIssue[]>([]);
  const timer = useRef<number | null>(null);
  // while there are unsaved edits the text is the user's, not the canvas'
  const text = draft ?? fromCanvas;

  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const origin = () =>
    viewportCoordsToSceneCoords(
      {
        clientX: app.state.offsetLeft + 80,
        clientY: app.state.offsetTop + 120,
      },
      app.state,
    );

  const commit = () => {
    app.store.scheduleCapture();
    app.setState({});
  };

  const run = (id: string, source: string) => {
    const { graph, issues: found } = parseFlow(source);
    setIssues(found);
    if (found.some((i) => !i.warn)) {
      return;
    }
    const skipped = applyFlow(app.scene, id, graph, {
      x: origin().x,
      y: origin().y,
    });
    setIssues([...found, ...skipped.map((i) => ({ ...i, warn: true }))]);
    commit();
    setDraft(null);
  };

  const onEdit = (value: string) => {
    setDraft(value);
    if (timer.current) {
      window.clearTimeout(timer.current);
    }
    if (flowId) {
      timer.current = window.setTimeout(() => run(flowId, value), 500);
    }
  };

  const newFlow = () => {
    let n = flows.length + 1;
    while (flows.includes(`Flow ${n}`)) {
      n++;
    }
    const id = `Flow ${n}`;
    setChosen(id);
    run(id, STARTER);
  };

  const adopt = () => {
    const id = flowId ?? "Flow 1";
    const n = adoptIntoFlow(app.scene, selected, id);
    if (n) {
      setChosen(id);
      setDraft(null);
      commit();
    }
  };

  const convert = () => {
    const key = app.flow.convertSelection(flowId ?? undefined);
    if (key) {
      setChosen(flowId ?? "Flow 1");
      setDraft(null);
      commit();
    }
  };

  const selectAll = () => {
    if (!flowId) {
      return;
    }
    const ids = elements
      .filter((e) => !e.isDeleted && getFlowMeta(e)?.id === flowId)
      .map((e) => e.id);
    app.setState({
      selectedElementIds: Object.fromEntries(ids.map((id) => [id, true])),
      selectedGroupIds: {},
    });
  };

  return (
    <div data-testid="inspector-flow" className="flow">
      <div className="flow__bar">
        {flows.length > 0 && (
          <select
            data-testid="flow-picker"
            className="flow__select"
            value={flowId ?? ""}
            onChange={(e) => {
              setChosen(e.target.value);
              setDraft(null);
              setIssues([]);
            }}
          >
            {flows.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="flow__btn flow__btn--primary"
          data-testid="flow-new"
          onClick={newFlow}
        >
          ＋ {t("labels.flow.new")}
        </button>
      </div>

      {flowId ? (
        <>
          <label className="flow__field">
            <span>{t("labels.flow.name")}</span>
            <input
              key={flowId}
              className="flow__input"
              data-testid="flow-name"
              defaultValue={flowId}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== flowId && !flows.includes(next)) {
                  renameFlow(app.scene, flowId, next);
                  setChosen(next);
                  commit();
                }
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </label>
          <textarea
            data-testid="flow-source"
            className="flow__source"
            spellCheck={false}
            value={text}
            onChange={(e) => onEdit(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div data-testid="flow-issues">
            {issues.map((i, k) => (
              <div
                key={k}
                className={`inspector__hint${
                  i.warn ? "" : " inspector__hint--error"
                }`}
                style={{ padding: "0.125rem 0" }}
              >
                {i.line ? `${t("labels.flow.line")} ${i.line}: ` : ""}
                {i.message}
              </div>
            ))}
          </div>
          <div className="flow__actions">
            <button
              type="button"
              className="flow__btn flow__btn--primary"
              data-testid="flow-convert"
              disabled={!selected.length}
              title={t("labels.flow.convertHint")}
              onClick={convert}
            >
              <FlowGraphIcon /> {t("labels.flow.convert")}
            </button>
            <button
              type="button"
              className="flow__btn"
              data-testid="flow-adopt"
              disabled={!selected.length}
              title={t("labels.flow.adoptHint")}
              onClick={adopt}
            >
              {t("labels.flow.adopt")}
            </button>
            <button
              type="button"
              className="flow__btn"
              data-testid="flow-select"
              onClick={selectAll}
            >
              {t("labels.flow.select")}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="inspector__hint">{t("labels.flow.empty")}</div>
          <div className="flow__actions">
            <button
              type="button"
              className="flow__btn flow__btn--primary"
              data-testid="flow-convert"
              disabled={!selected.length}
              title={t("labels.flow.convertHint")}
              onClick={convert}
            >
              <FlowGraphIcon /> {t("labels.flow.convert")}
            </button>
            <button
              type="button"
              className="flow__btn"
              data-testid="flow-adopt"
              disabled={!selected.length}
              onClick={adopt}
            >
              {t("labels.flow.adopt")}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
