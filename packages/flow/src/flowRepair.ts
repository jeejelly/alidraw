import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getFlowMeta } from "./flowMeta";

const edgeSignature = (element: ExcalidrawElement) => {
  const meta = getFlowMeta(element);
  if (element.type !== "arrow" || element.isDeleted || meta?.kind !== "edge") {
    return null;
  }
  return JSON.stringify([
    meta.id,
    meta.key,
    element.startBinding?.elementId ?? null,
    element.endBinding?.elementId ?? null,
    element.x,
    element.y,
    element.points,
  ]);
};

/**
 * Older saves can hold the same link arrow twice, drawn on top of itself.
 * The copy that the shapes list as bound (else the last one) stays; the
 * others are deleted.
 */
export const dropDuplicateLinks = <T extends ExcalidrawElement>(
  elements: readonly T[],
): T[] => {
  const boundIds = new Set(
    elements.flatMap((element) =>
      (element.boundElements ?? []).map((bound) => bound.id),
    ),
  );
  const groups = new Map<string, T[]>();
  for (const element of elements) {
    const signature = edgeSignature(element);
    if (signature) {
      groups.set(signature, [...(groups.get(signature) ?? []), element]);
    }
  }
  const dropped = new Set<string>();
  for (const copies of groups.values()) {
    if (copies.length < 2) {
      continue;
    }
    const kept =
      copies.find((copy) => boundIds.has(copy.id)) ?? copies[copies.length - 1];
    copies.forEach((copy) => copy !== kept && dropped.add(copy.id));
  }
  if (!dropped.size) {
    return elements as T[];
  }
  return elements.map((element) =>
    dropped.has(element.id)
      ? ({ ...element, isDeleted: true, version: element.version + 1 } as T)
      : element,
  );
};
