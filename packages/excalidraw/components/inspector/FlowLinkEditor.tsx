import {
  curveLink,
  edgeStyleOf,
  getFlowMeta,
  linkLabelOf,
  makeFlowLink,
  routeOf,
  setLinkEnd,
  setLinkLabel,
  setLinkLine,
  setLinkPorts,
  stepPortsOf,
  straightenLink,
  type FlowSelection,
  type LinkLine,
  type LinkRoute,
  type LinkSide,
} from "@excalidraw/flow";

import type { FlowEnd } from "@excalidraw/flow";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { actionChangeArrowType } from "../../actions/actionProperties";
import { t } from "../../i18n";

import { Segmented } from "./primitives";

import type App from "../App";

type Link = Extract<NonNullable<FlowSelection>, { kind: "link" }>;
type End = FlowEnd | "none";

const endOf = (arrow: ExcalidrawArrowElement, side: LinkSide): End => {
  const named =
    getFlowMeta(arrow)?.link?.[side === "head" ? "headEnd" : "tailEnd"];
  const arrowhead = side === "head" ? arrow.endArrowhead : arrow.startArrowhead;
  return named ?? (arrowhead ? "arrow" : "none");
};

const PortSelect = ({
  label,
  value,
  names,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  names: readonly string[];
  onChange: (name: string) => void;
  testId: string;
}) => (
  <div className="inspector__row">
    <span className="inspector__label">{label}</span>
    <select
      className="inspector__select"
      data-testid={testId}
      aria-label={label}
      value={value}
      disabled={!names.length}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t("labels.flow.selection.automatic")}</option>
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  </div>
);

/** ends, line, route, ports and label of a link: written onto the arrow itself, which stays the same arrow */
export const FlowLinkEditor = ({
  app,
  link,
  onChange,
}: {
  app: App;
  link: Link;
  onChange: () => void;
}) => {
  const { arrow, tagged } = link;
  const scene = app.scene;
  const change = (apply: () => void) => {
    apply();
    onChange();
  };
  if (!tagged) {
    return (
      <div data-testid="flow-link-editor">
        <div className="inspector__hint">
          {t("labels.flow.selection.makeLinkHint")}
        </div>
        <button
          type="button"
          className="inspector__action"
          data-testid="flow-link-make"
          onClick={() => change(() => makeFlowLink(scene, arrow))}
        >
          {t("labels.flow.selection.makeLink")}
        </button>
      </div>
    );
  }

  const meta = getFlowMeta(arrow)!;
  const elements = scene.getNonDeletedElementsMap();
  const portNames = (binding: ExcalidrawArrowElement["startBinding"]) => {
    const step = binding && elements.get(binding.elementId);
    return step ? stepPortsOf(step).map((port) => port.name) : [];
  };
  const setRoute = (route: LinkRoute) =>
    change(() => {
      if (route === "elbow") {
        app.actionManager.executeAction(actionChangeArrowType, "ui", "elbow");
        return;
      }
      if (arrow.elbowed) {
        // the action brings an elbow back to a plain arrow, bindings kept
        app.actionManager.executeAction(
          actionChangeArrowType,
          "ui",
          route === "curved" ? "round" : "sharp",
        );
      }
      const current = scene.getElement(arrow.id) as ExcalidrawArrowElement;
      return route === "curved"
        ? curveLink(scene, current)
        : straightenLink(scene, current);
    });
  const endOptions = () =>
    (
      [
        ["none", "endNone"],
        ["arrow", "endArrow"],
        ["cross", "endCross"],
        ["circle", "endCircle"],
      ] as const
    ).map(([value, key]) => ({
      value,
      text: t(`labels.flow.selection.${key}`),
    }));

  return (
    <div data-testid="flow-link-editor">
      {(["tail", "head"] as const).map((side) => (
        <Segmented<End>
          key={side}
          label={t(`labels.flow.selection.${side}`)}
          testId={`flow-link-${side}`}
          options={endOptions()}
          value={endOf(arrow, side)}
          onChange={(end) => change(() => setLinkEnd(scene, arrow, side, end))}
        />
      ))}
      <Segmented<LinkLine>
        label={t("labels.flow.selection.line")}
        testId="flow-link-line"
        options={(["solid", "dashed", "thick"] as const).map((value) => ({
          value,
          text: t(`labels.flow.selection.${value}`),
        }))}
        value={edgeStyleOf(arrow) as LinkLine}
        onChange={(line) => change(() => setLinkLine(scene, arrow, line))}
      />
      <Segmented<LinkRoute>
        label={t("labels.flow.selection.route")}
        testId="flow-link-route"
        options={(["straight", "curved", "elbow"] as const).map((value) => ({
          value,
          text: t(`labels.flow.selection.${value}`),
        }))}
        value={routeOf(arrow)}
        onChange={setRoute}
      />
      <PortSelect
        label={t("labels.flow.selection.fromPort")}
        testId="flow-link-from-port"
        value={meta.link?.fromPort ?? ""}
        names={portNames(arrow.startBinding)}
        onChange={(name) =>
          change(() => setLinkPorts(scene, arrow, { fromPort: name || null }))
        }
      />
      <PortSelect
        label={t("labels.flow.selection.toPort")}
        testId="flow-link-to-port"
        value={meta.link?.toPort ?? ""}
        names={portNames(arrow.endBinding)}
        onChange={(name) =>
          change(() => setLinkPorts(scene, arrow, { toPort: name || null }))
        }
      />
      <label className="flow__field">
        <span>{t("labels.flow.selection.label")}</span>
        <input
          key={`${arrow.id}/${linkLabelOf(scene, arrow)?.text ?? ""}`}
          className="flow__input"
          data-testid="flow-link-label"
          defaultValue={linkLabelOf(scene, arrow)?.text ?? ""}
          onBlur={(event) => {
            const text = event.target.value.trim();
            if (text !== (linkLabelOf(scene, arrow)?.text ?? "")) {
              change(() => setLinkLabel(scene, arrow, text));
            }
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
      </label>
    </div>
  );
};
