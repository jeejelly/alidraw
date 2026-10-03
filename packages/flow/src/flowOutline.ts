import { getCommonBounds, updateBoundElements } from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getFlowMeta } from "./flowMeta";
import { partsOf } from "./flowParts";
import { HANDLE_SIZE, LABEL_GAP, PAD } from "./flowStyle";
import { expandSelection } from "./flowWrap";

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
  const outline = targets.find((element) => {
    const flowMeta = getFlowMeta(element);
    return (
      !!flowMeta &&
      flowMeta.id === flowId &&
      !!flowMeta.wrap &&
      !!flowMeta.placeholder
    );
  });
  if (!outline) {
    return null;
  }
  const meta = getFlowMeta(outline)!;
  const inside = (element: ExcalidrawElement) =>
    element.groupIds.includes(meta.group!);
  const incoming = targets.filter((element) => !inside(element));
  const box = all.find(
    (element) =>
      !element.isDeleted &&
      element.customData?.flowPlaceholder &&
      inside(element),
  );
  if (!incoming.length || !box) {
    return null;
  }
  const [x1, y1, x2, y2] = getCommonBounds(incoming);
  const dx = box.x + box.width / 2 - (x1 + x2) / 2;
  const dy = box.y + box.height / 2 - (y1 + y2) / 2;
  for (const element of incoming) {
    scene.mutateElement(element, {
      x: element.x + dx,
      y: element.y + dy,
      groupIds: [...element.groupIds, meta.group!],
    } as any);
  }
  scene.mutateElement(box, { isDeleted: true } as any);
  scene.mutateElement(outline, {
    customData: {
      ...outline.customData,
      flow: { ...meta, placeholder: false },
    },
  } as any);
  refitFlowElement(scene, outline);
  return meta.key;
};

/** the outline, label and handle of one flow element */
const ownParts = (
  all: readonly ExcalidrawElement[],
  outline: ExcalidrawElement,
) => {
  const meta = getFlowMeta(outline)!;
  return all.filter((element) => {
    const flowMeta = !element.isDeleted ? getFlowMeta(element) : null;
    return (
      !!flowMeta &&
      flowMeta.id === meta.id &&
      flowMeta.key === meta.key &&
      (flowMeta.kind === "label" ||
        flowMeta.kind === "handle" ||
        element.id === outline.id)
    );
  });
};

/** what a flow element wraps: everything in its group that is not its own */
export const wrappedBy = (
  all: readonly ExcalidrawElement[],
  outline: ExcalidrawElement,
) => {
  const group = getFlowMeta(outline)?.group;
  const own = new Set(ownParts(all, outline).map((element) => element.id));
  return all.filter(
    (element) =>
      !element.isDeleted &&
      !!group &&
      element.groupIds.includes(group) &&
      !own.has(element.id),
  );
};

/** the outline hugs what it wraps again; label and handle follow, links reroute */
export const refitFlowElement = (scene: Scene, outline: ExcalidrawElement) => {
  const all = scene.getElementsIncludingDeleted();
  const meta = getFlowMeta(outline)!;
  const content = wrappedBy(all, outline);
  if (!content.length) {
    return;
  }
  const [x1, y1, x2, y2] = getCommonBounds(content);
  const rx = x1 - PAD;
  const ry = y1 - PAD;
  const rw = x2 - x1 + PAD * 2;
  const rh = y2 - y1 + PAD * 2;
  scene.mutateElement(outline, { x: rx, y: ry, width: rw, height: rh } as any);
  const { labels, handles } = partsOf(all, meta.id);
  const label = labels.get(meta.key);
  const handle = handles.get(meta.key);
  if (label) {
    scene.mutateElement(label, { x: rx, y: ry - LABEL_GAP } as any);
  }
  if (handle) {
    scene.mutateElement(handle, {
      x: rx + rw - HANDLE_SIZE / 2,
      y: ry + rh / 2 - HANDLE_SIZE / 2,
    } as any);
  }
  updateBoundElements(outline as any, scene);
};

/**
 * Replacing something that is (part of) a flow element must replace what it
 * wraps, never the flow element: its outline, label, handle and links stay.
 * Returns the outline, what goes, and the groups the new content must join.
 */
export const flowReplaceTarget = (
  all: readonly ExcalidrawElement[],
  selected: readonly ExcalidrawElement[],
) => {
  const live = all.filter((element) => !element.isDeleted);
  const outlines = new Map<string, ExcalidrawElement>();
  for (const element of live) {
    const flowMeta = getFlowMeta(element);
    if (flowMeta?.wrap && flowMeta.group && element.type !== "text") {
      outlines.set(flowMeta.group, element);
    }
  }
  if (!outlines.size) {
    return null;
  }
  const ids = new Set(selected.map((element) => element.id));
  // the outermost flow element the selection belongs to
  let best: ExcalidrawElement | null = null;
  let bestSize = -1;
  for (const element of selected) {
    for (const groupId of element.groupIds) {
      const outline = outlines.get(groupId);
      if (!outline) {
        continue;
      }
      const size = live.filter((member) =>
        member.groupIds.includes(groupId),
      ).length;
      // a flow element counts when the selection takes some of what it wraps
      // or its outline; the outermost such one wins
      if (size > bestSize) {
        best = outline;
        bestSize = size;
      }
    }
  }
  if (!best) {
    return null;
  }
  const meta = getFlowMeta(best)!;
  const wrapped = wrappedBy(all, best);
  // the whole outline selected: all that it wraps is replaced; part selected: only that part
  const wholeSelected = ids.has(best.id);
  const remove = wholeSelected
    ? wrapped
    : wrapped.filter((element) => ids.has(element.id));
  if (!remove.length) {
    return null;
  }
  const chain = best.groupIds.slice(best.groupIds.indexOf(meta.group!));
  return { outline: best, remove, chain };
};
