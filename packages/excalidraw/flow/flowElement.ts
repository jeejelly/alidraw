import { randomId, ROUNDNESS } from "@excalidraw/common";
import {
  convertToExcalidrawElements,
  getCommonBounds,
  newElementWith,
  updateBoundElements,
} from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { getSymbolMeta } from "../symbols/build";

import { getFlowMeta, linkEnds, partsOf, textOf } from "./flowCanvas";
import { slugKey } from "./flowGraph";

import type { FlowMeta } from "./flowCanvas";

/**
 * Flow elements: any object or group wrapped (decorator style) in an outline
 * with a label above and a handle on its edge. They share one group with what
 * they wrap, so the wrapped objects stay as editable as before. A flow element
 * can be wrapped by another one: that makes a screen out of its parts.
 * Dragging the handle links to another flow element or makes a placeholder.
 */
const PAD = 18;
const ACCENT = "#e0449b";
const HANDLE = "#12b886";
const HANDLE_SIZE = 16;
export const PLACEHOLDER = { w: 160, h: 80 };
const LABEL_GAP = 26;

const isFlowPart = (el: ExcalidrawElement) => {
  const m = getFlowMeta(el);
  return !!m && (m.kind === "label" || m.kind === "handle" || !!m.wrap);
};

/** what a selection stands for: whole groups, labels with their boxes */
export const expandSelection = (
  all: readonly ExcalidrawElement[],
  selected: readonly ExcalidrawElement[],
) => {
  const live = all.filter((e) => !e.isDeleted);
  const byId = new Map(live.map((e) => [e.id, e]));
  const ids = new Set<string>();
  for (const picked of selected) {
    const el = byId.get(picked.id);
    if (!el) {
      continue;
    }
    ids.add(el.id);
    if (el.groupIds.length) {
      const outer = el.groupIds[el.groupIds.length - 1];
      for (const e of live) {
        if (e.groupIds.includes(outer)) {
          ids.add(e.id);
        }
      }
    }
  }
  for (const id of [...ids]) {
    const el = byId.get(id)!;
    for (const b of el.boundElements ?? []) {
      if (b.type === "text" && byId.has(b.id)) {
        ids.add(b.id);
      }
    }
    if (el.type === "text" && el.containerId && byId.has(el.containerId)) {
      ids.add(el.containerId);
    }
  }
  return live.filter((e) => ids.has(e.id) && e.type !== "frame");
};

const labelFor = (targets: readonly ExcalidrawElement[]) => {
  for (const el of targets) {
    if (isFlowPart(el)) {
      continue;
    }
    const symbol = getSymbolMeta(el);
    const fromSymbol = symbol?.label;
    if (fromSymbol) {
      return String(fromSymbol).slice(0, 30);
    }
    if (el.type === "text") {
      return (el as ExcalidrawTextElement).text.split("\n")[0].slice(0, 30);
    }
  }
  return "";
};

type Made = {
  key: string;
  /** the outline of the new flow element */
  outline: string;
  group: string;
};

/**
 * Wraps `selected` in a flow element of `flowId`. Returns null when there is
 * nothing to wrap or the selection already is one flow element.
 */
export const wrapAsFlowElement = (
  scene: Scene,
  selected: readonly ExcalidrawElement[],
  flowId: string,
  options: { label?: string; placeholder?: boolean } = {},
): Made | null => {
  const all = scene.getElementsIncludingDeleted();
  const targets = expandSelection(all, selected);
  if (!targets.length) {
    return null;
  }
  const outerOf = (e: ExcalidrawElement) =>
    e.groupIds[e.groupIds.length - 1] ?? e.id;
  const outers = new Set(targets.map(outerOf));
  if (
    outers.size === 1 &&
    targets.some((e) => {
      const m = getFlowMeta(e);
      return !!m && m.id === flowId && !!m.wrap && m.group === outerOf(e);
    })
  ) {
    return null;
  }

  const taken = new Set<string>();
  let count = 0;
  for (const el of all) {
    const m = !el.isDeleted ? getFlowMeta(el) : null;
    if (m && m.id === flowId && (m.kind === "node" || m.kind === "screen")) {
      taken.add(m.key);
      count++;
    }
  }
  const holdsFlowElement = targets.some((e) => {
    const m = getFlowMeta(e);
    return !!m && m.id === flowId && !!m.wrap;
  });
  const label =
    options.label ??
    (labelFor(targets) ||
      (options.placeholder
        ? `Step ${count + 1}`
        : holdsFlowElement
        ? "Screen"
        : "Step"));
  const key = slugKey(label, taken);
  const group = randomId();
  const outline = randomId();
  const [x1, y1, x2, y2] = getCommonBounds(targets);
  const rx = x1 - PAD;
  const ry = y1 - PAD;
  const rw = x2 - x1 + PAD * 2;
  const rh = y2 - y1 + PAD * 2;
  const frames = new Set(targets.map((e) => e.frameId ?? null));
  const frameId = frames.size === 1 ? [...frames][0] : null;
  const meta: FlowMeta = {
    id: flowId,
    key,
    kind: "node",
    wrap: true,
    group,
    ...(options.placeholder ? { placeholder: true } : {}),
  };
  const made = convertToExcalidrawElements(
    [
      {
        type: "rectangle",
        id: outline,
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        strokeColor: ACCENT,
        backgroundColor: "transparent",
        strokeStyle: "dashed",
        strokeWidth: 1,
        roughness: 0,
        roundness: null,
        groupIds: [group],
        frameId,
        customData: { flow: meta },
      },
      {
        type: "text",
        x: rx,
        y: ry - LABEL_GAP,
        text: label,
        fontSize: 16,
        strokeColor: ACCENT,
        groupIds: [group],
        frameId,
        customData: { flow: { id: flowId, key, kind: "label" } },
      },
      {
        type: "ellipse",
        x: rx + rw - HANDLE_SIZE / 2,
        y: ry + rh / 2 - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        strokeColor: HANDLE,
        backgroundColor: HANDLE,
        fillStyle: "solid",
        roughness: 0,
        strokeWidth: 1,
        groupIds: [group],
        frameId,
        customData: { flow: { id: flowId, key, kind: "handle" } },
      },
    ] as any,
    { regenerateIds: false },
  );
  const [box, text, handle] = made;

  const targetIds = new Set(targets.map((e) => e.id));
  const first = all.findIndex((e) => targetIds.has(e.id));
  let last = first;
  all.forEach((e, i) => {
    if (targetIds.has(e.id)) {
      last = i;
    }
  });
  const next: ExcalidrawElement[] = [];
  all.forEach((e, i) => {
    if (i === first) {
      next.push(box);
    }
    next.push(
      targetIds.has(e.id)
        ? newElementWith(e, { groupIds: [...e.groupIds, group] })
        : e,
    );
    if (i === last) {
      next.push(text, handle);
    }
  });
  scene.replaceAllElements(next);
  return { key, outline, group };
};

/** a box where a link was dropped on nothing: to be replaced by the real thing */
export const addPlaceholder = (
  scene: Scene,
  flowId: string,
  center: { x: number; y: number },
) => {
  const [box] = convertToExcalidrawElements(
    [
      {
        type: "rectangle",
        x: center.x - PLACEHOLDER.w / 2,
        y: center.y - PLACEHOLDER.h / 2,
        width: PLACEHOLDER.w,
        height: PLACEHOLDER.h,
        strokeColor: "#868e96",
        backgroundColor: "#f1f3f5",
        fillStyle: "solid",
        roughness: 0,
        roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
        customData: { flowPlaceholder: true },
      },
    ] as any,
    { regenerateIds: false },
  );
  scene.replaceAllElements([...scene.getElementsIncludingDeleted(), box]);
  return wrapAsFlowElement(scene, [box], flowId, { placeholder: true });
};

/** the flow elements an element belongs to, innermost first */
const wrapperKeysOf = (
  all: readonly ExcalidrawElement[],
  el: ExcalidrawElement,
  flowId: string,
) => {
  const byGroup = new Map<string, string>();
  for (const o of all) {
    const m = !o.isDeleted ? getFlowMeta(o) : null;
    if (m && m.id === flowId && m.wrap && m.group) {
      byGroup.set(m.group, m.key);
    }
  }
  return el.groupIds.flatMap((g) => (byGroup.has(g) ? [byGroup.get(g)!] : []));
};

/** the flow element (key) a link dropped on `el` reaches, or null */
export const flowKeyAt = (
  all: readonly ExcalidrawElement[],
  el: ExcalidrawElement,
  flowId: string,
  excluded: ReadonlySet<string>,
): { key: string | null; onlyExcluded: boolean } => {
  const keys = wrapperKeysOf(all, el, flowId);
  const free = keys.find((k) => !excluded.has(k));
  return { key: free ?? null, onlyExcluded: !free && keys.length > 0 };
};

/** the keys of a flow element and of every flow element around it */
export const selfAndAncestors = (
  all: readonly ExcalidrawElement[],
  flowId: string,
  key: string,
) => {
  const { wrapParent } = partsOf(all, flowId);
  const out = new Set<string>([key]);
  for (let k = wrapParent.get(key); k && !out.has(k); k = wrapParent.get(k)) {
    out.add(k);
  }
  return out;
};

/** a link from one flow element to another; nothing if there already is one */
export const addLink = (
  scene: Scene,
  flowId: string,
  fromKey: string,
  toKey: string,
  label = "",
) => {
  const all = scene.getElementsIncludingDeleted();
  const { byKey, keyOfId, map } = partsOf(all, flowId);
  const a = byKey.get(fromKey);
  const b = byKey.get(toKey);
  if (!a || !b || a.id === b.id) {
    return null;
  }
  for (const e of all) {
    if (
      !e.isDeleted &&
      e.type === "arrow" &&
      e.startBinding &&
      e.endBinding &&
      keyOfId.get(e.startBinding.elementId) === fromKey &&
      keyOfId.get(e.endBinding.elementId) === toKey
    ) {
      return null;
    }
  }
  const rect = (e: ExcalidrawElement) => ({
    x: e.x,
    y: e.y,
    w: e.width,
    h: e.height,
    type: e.type,
  });
  const [p0, p1] = linkEnds(rect(a), rect(b), 0);
  const id = randomId();
  const out = convertToExcalidrawElements(
    [
      { ...a, boundElements: [], frameId: null },
      { ...b, boundElements: [], frameId: null },
      {
        type: "arrow",
        id,
        x: p0[0],
        y: p0[1],
        width: Math.abs(p1[0] - p0[0]),
        height: Math.abs(p1[1] - p0[1]),
        points: [
          [0, 0],
          [p1[0] - p0[0], p1[1] - p0[1]],
        ],
        start: { id: a.id },
        end: { id: b.id },
        endArrowhead: "arrow",
        strokeWidth: 2,
        customData: {
          flow: { id: flowId, key: `${fromKey}>${toKey}`, kind: "edge" },
        },
        ...(label ? { label: { text: label } } : {}),
      },
    ] as any,
    { regenerateIds: false },
  );
  const arrows = out.filter(
    (e) => e.id === id || (e.type === "text" && e.containerId === id),
  );
  const ref = { type: "arrow" as const, id };
  void map;
  scene.replaceAllElements([
    ...all.map((e) =>
      e.id === a.id || e.id === b.id
        ? newElementWith(e, {
            boundElements: [...(e.boundElements ?? []), ref],
          })
        : e,
    ),
    ...arrows,
  ]);
  return id;
};

/**
 * Selected placeholder + real objects: the objects take the placeholder's
 * place and become what it stands for; its links and label stay.
 * Returns the key, or null when the selection is not that.
 */
export const fillPlaceholder = (
  scene: Scene,
  selected: readonly ExcalidrawElement[],
  flowId: string,
) => {
  const all = scene.getElementsIncludingDeleted();
  const targets = expandSelection(all, selected);
  const outline = targets.find((e) => {
    const m = getFlowMeta(e);
    return !!m && m.id === flowId && !!m.wrap && !!m.placeholder;
  });
  if (!outline) {
    return null;
  }
  const meta = getFlowMeta(outline)!;
  const inside = (e: ExcalidrawElement) => e.groupIds.includes(meta.group!);
  const incoming = targets.filter((e) => !inside(e));
  const box = all.find(
    (e) => !e.isDeleted && e.customData?.flowPlaceholder && inside(e),
  );
  if (!incoming.length || !box) {
    return null;
  }
  const [x1, y1, x2, y2] = getCommonBounds(incoming);
  const dx = box.x + box.width / 2 - (x1 + x2) / 2;
  const dy = box.y + box.height / 2 - (y1 + y2) / 2;
  for (const e of incoming) {
    scene.mutateElement(e, {
      x: e.x + dx,
      y: e.y + dy,
      groupIds: [...e.groupIds, meta.group!],
    } as any);
  }
  scene.mutateElement(box, { isDeleted: true } as any);
  const rx = x1 + dx - PAD;
  const ry = y1 + dy - PAD;
  const rw = x2 - x1 + PAD * 2;
  const rh = y2 - y1 + PAD * 2;
  scene.mutateElement(outline, {
    x: rx,
    y: ry,
    width: rw,
    height: rh,
    customData: {
      ...outline.customData,
      flow: { ...meta, placeholder: false },
    },
  } as any);
  const { labels, handles } = partsOf(
    scene.getElementsIncludingDeleted(),
    flowId,
  );
  const l = labels.get(meta.key);
  const h = handles.get(meta.key);
  if (l) {
    scene.mutateElement(l, { x: rx, y: ry - LABEL_GAP } as any);
  }
  if (h) {
    scene.mutateElement(h, {
      x: rx + rw - HANDLE_SIZE / 2,
      y: ry + rh / 2 - HANDLE_SIZE / 2,
    } as any);
  }
  updateBoundElements(outline as any, scene);
  return meta.key;
};

export { textOf };
