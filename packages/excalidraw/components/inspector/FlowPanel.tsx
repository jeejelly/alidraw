import { useEffect, useRef, useState } from "react";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";

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

import { FlowFiles } from "./FlowFiles";
import { FlowSelection } from "./FlowSelection";

import { Segmented } from "./primitives";

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
    const off = app.scene.onUpdate(() => bump((count) => count + 1));
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
    if (found.some((issue) => !issue.warn)) {
      return;
    }
    const skipped = applyFlow(app.scene, id, graph, {
      x: origin().x,
      y: origin().y,
    });
    app.layers.assignFlow(id);
    setIssues([
      ...found,
      ...skipped.map((issue) => ({ ...issue, warn: true })),
    ]);
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
    let number = flows.length + 1;
    while (flows.includes(`Flow ${number}`)) {
      number++;
    }
    const id = `Flow ${number}`;
    setChosen(id);
    run(id, STARTER);
  };

  /** the layout line of the source text, and the text with another one */
  const layoutOf = (source: string): "flow" | "cascade" =>
    parseFlow(source).graph.layout === "cascade" ? "cascade" : "flow";
  const withLayout = (source: string, mode: "flow" | "cascade") => {
    const lines = source
      .split("\n")
      .filter((line) => !/^\s*%%\s*@flow\s+layout\b/i.test(line));
    const header = lines.findIndex((line) =>
      /^\s*(flowchart|graph)\b/i.test(line),
    );
    if (mode === "cascade" && header >= 0) {
      lines.splice(header + 1, 0, "  %% @flow layout cascade");
    }
    return lines.join("\n");
  };
  /** a new layout draws the flow again from its top left, so every step is placed anew */
  const changeLayout = (mode: "flow" | "cascade") => {
    if (!flowId || mode === layoutOf(text)) {
      return;
    }
    const mine = app.scene
      .getNonDeletedElements()
      .filter((element) => getFlowMeta(element)?.id === flowId);
    const inFlow = new Set(mine.map((element) => element.id));
    const corner = mine.length
      ? {
          x: Math.min(...mine.map((element) => element.x)),
          y: Math.min(...mine.map((element) => element.y)),
        }
      : origin();
    app.scene.replaceAllElements(
      app.scene
        .getElementsIncludingDeleted()
        .map((element) =>
          inFlow.has(element.id) ||
          (element.type === "text" &&
            element.containerId &&
            inFlow.has(element.containerId))
            ? newElementWith(element, { isDeleted: true })
            : element,
        ),
    );
    const source = withLayout(text, mode);
    const { graph, issues: found } = parseFlow(source);
    setIssues(found);
    applyFlow(app.scene, flowId, graph, corner);
    app.layers.assignFlow(flowId);
    commit();
    setDraft(null);
  };

  const adopt = () => {
    const id = flowId ?? "Flow 1";
    const adopted = adoptIntoFlow(app.scene, selected, id);
    if (adopted) {
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
      .filter(
        (element) => !element.isDeleted && getFlowMeta(element)?.id === flowId,
      )
      .map((element) => element.id);
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
            onChange={(changeEvent) => {
              setChosen(changeEvent.target.value);
              setDraft(null);
              setIssues([]);
            }}
          >
            {flows.map((flow) => (
              <option key={flow} value={flow}>
                {flow}
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

      <FlowFiles
        app={app}
        flowId={flowId}
        allFlows={flows}
        onImported={(id) => {
          setChosen(id);
          setDraft(null);
          setIssues([]);
        }}
      />

      <FlowSelection app={app} />

      {flowId ? (
        <>
          <label className="flow__field">
            <span>{t("labels.flow.name")}</span>
            <input
              key={flowId}
              className="flow__input"
              data-testid="flow-name"
              defaultValue={flowId}
              onBlur={(blurEvent) => {
                const next = blurEvent.target.value.trim();
                if (next && next !== flowId && !flows.includes(next)) {
                  renameFlow(app.scene, flowId, next);
                  app.layers.renameFlow(flowId, next);
                  setChosen(next);
                  commit();
                }
              }}
              onKeyDown={(keyEvent) => {
                keyEvent.stopPropagation();
                if (keyEvent.key === "Enter") {
                  (keyEvent.target as HTMLInputElement).blur();
                }
              }}
            />
          </label>
          <Segmented<"flow" | "cascade">
            label={t("labels.flow.layout")}
            value={layoutOf(text)}
            onChange={changeLayout}
            testId="flow-layout"
            options={[
              {
                value: "flow",
                text: t("labels.flow.layoutFlow"),
                title: t("labels.flow.layoutFlowHint"),
              },
              {
                value: "cascade",
                text: t("labels.flow.layoutCascade"),
                title: t("labels.flow.layoutCascadeHint"),
              },
            ]}
          />
          <textarea
            data-testid="flow-source"
            className="flow__source"
            spellCheck={false}
            value={text}
            onChange={(changeEvent) => onEdit(changeEvent.target.value)}
            onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
          />
          <div data-testid="flow-issues">
            {issues.map((issue, index) => (
              <div
                key={index}
                className={`inspector__hint${
                  issue.warn ? "" : " inspector__hint--error"
                }`}
                style={{ padding: "0.125rem 0" }}
              >
                {issue.line ? `${t("labels.flow.line")} ${issue.line}: ` : ""}
                {issue.message}
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
