import { useEffect, useRef, useState } from "react";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import {
  adoptIntoFlow,
  applyFlow,
  getFlowMeta,
  listFlows,
  readFlow,
  renameFlow,
} from "../../flow/flowCanvas";
import { parseFlow, serializeFlow, type FlowIssue } from "../../flow/flowGraph";
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
    <div data-testid="inspector-flow" style={{ padding: "0.5rem" }}>
      <div className="inspector__row" style={{ marginTop: 0 }}>
        {flows.length > 0 && (
          <select
            data-testid="flow-picker"
            className="inspector__select"
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
          className="inspector__text"
          style={{ cursor: "pointer", marginLeft: "auto" }}
          data-testid="flow-new"
          onClick={newFlow}
        >
          ＋ {t("labels.flow.new")}
        </button>
      </div>

      {flowId ? (
        <>
          <div className="inspector__row">
            <span className="inspector__label">{t("labels.flow.name")}</span>
            <input
              key={flowId}
              className="inspector__layer-input"
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
          </div>
          <textarea
            data-testid="flow-source"
            className="inspector__source"
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
          <div className="inspector__row">
            <button
              type="button"
              className="inspector__text"
              style={{ cursor: "pointer" }}
              data-testid="flow-adopt"
              disabled={!selected.length}
              title={t("labels.flow.adoptHint")}
              onClick={adopt}
            >
              {t("labels.flow.adopt")}
            </button>
            <button
              type="button"
              className="inspector__text"
              style={{ cursor: "pointer" }}
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
          <div className="inspector__row">
            <button
              type="button"
              className="inspector__text"
              style={{ cursor: "pointer" }}
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
