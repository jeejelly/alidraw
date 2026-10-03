import { getPathUpdate, newPathElement } from "@excalidraw/element";

import type { getOutline } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

/** a closed path with the outline `loop` and the look of `source` */
export const asClosedPath = (
  source: ExcalidrawElement,
  loop: NonNullable<ReturnType<typeof getOutline>>,
  groupIds: readonly string[] = source.groupIds,
) => {
  // scene coordinates, no rotation: a frame at the origin
  const frame = {
    ...source,
    type: "path",
    x: 0,
    y: 0,
    angle: 0,
    width: 0,
    height: 0,
    closed: true,
    contours: undefined,
    ...loop,
  } as unknown as ExcalidrawPathElement;
  return newPathElement({
    strokeColor: source.strokeColor,
    backgroundColor: source.backgroundColor,
    fillStyle: source.fillStyle,
    strokeWidth: source.strokeWidth,
    strokeStyle: source.strokeStyle,
    roughness: source.roughness,
    opacity: source.opacity,
    roundness: null,
    groupIds,
    frameId: source.frameId,
    ...getPathUpdate(frame, loop),
    closed: true,
  });
};
