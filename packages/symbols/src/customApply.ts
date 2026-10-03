import {
  redrawTextBoundingBox,
  updateBoundElements,
} from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { getSymbolMeta } from "./build";
import {
  customOf,
  freshKey,
  makeParam,
  paramUpdates,
  readProp,
  type CustomMeta,
  type CustomParam,
  type CustomProp,
} from "./custom";

/** writes the root's meta (parameters and their values) */
const writeRoot = (
  scene: Scene,
  root: ExcalidrawElement,
  patch: Partial<CustomMeta>,
) => {
  const meta = getSymbolMeta(root) as CustomMeta;
  scene.mutateElement(root, {
    customData: { ...root.customData, symbol: { ...meta, ...patch } },
  } as any);
};

/** sets one parameter of a custom symbol, on every part it reaches */
export const setCustomParam = (
  scene: Scene,
  members: readonly ExcalidrawElement[],
  key: string,
  value: string | number | boolean,
) => {
  const { params, root, values } = customOf(members);
  const param = params.find((candidate) => candidate.key === key);
  if (!param || !root) {
    return;
  }
  const map = scene.getNonDeletedElementsMap();
  for (const [id, update] of paramUpdates(members, param, value)) {
    const el = scene.getElement(id);
    if (!el) {
      continue;
    }
    scene.mutateElement(el, update as any);
    if (update.text !== undefined && el.type === "text") {
      const text = el as ExcalidrawTextElement;
      const container = scene.getContainerElement(text);
      redrawTextBoundingBox(text, container, scene);
      if (container) {
        updateBoundElements(container as NonDeletedExcalidrawElement, scene);
      }
    }
  }
  void map;
  writeRoot(scene, root, {
    values: { ...values, [key]: value },
    params: params.map((entry) =>
      entry.key === key ? { ...entry, value } : entry,
    ),
  });
};

/** exposes a property of a part (and the parts sharing its value) as a new parameter */
export const addCustomParam = (
  scene: Scene,
  members: readonly ExcalidrawElement[],
  part: ExcalidrawElement,
  prop: CustomProp,
  label: string,
  sameValue = true,
) => {
  const { parts, params, root, values } = customOf(members);
  const at = parts.findIndex((element) => element.id === part.id);
  if (!root || at < 0) {
    return null;
  }
  const mine = readProp(part, prop);
  const indexes =
    sameValue && (prop === "backgroundColor" || prop === "strokeColor")
      ? parts.flatMap((element, index) =>
          readProp(element, prop) === mine &&
          (element.type === "text") === (part.type === "text")
            ? [index]
            : [],
        )
      : [at];
  // part numbers are positions in the symbol: the meta of each element says which it is
  const numbers = indexes.map(
    (index) =>
      (getSymbolMeta(parts[index]) as CustomMeta | null)?.part ?? index,
  );
  const key = freshKey(
    params,
    label.toLowerCase().replace(/[^a-z0-9]+/g, "") || "param",
  );
  const param: CustomParam = makeParam(
    key,
    label.trim() || key,
    prop,
    parts,
    indexes,
  );
  param.targets = numbers.map((partIndex) => ({ part: partIndex, prop }));
  writeRoot(scene, root, {
    params: [...params, param],
    values: { ...values, [key]: param.value },
  });
  return param;
};

export const renameCustomParam = (
  scene: Scene,
  members: readonly ExcalidrawElement[],
  key: string,
  label: string,
) => {
  const { params, root } = customOf(members);
  if (root && label.trim()) {
    writeRoot(scene, root, {
      params: params.map((param) =>
        param.key === key ? { ...param, label: label.trim() } : param,
      ),
    });
  }
};

export const removeCustomParam = (
  scene: Scene,
  members: readonly ExcalidrawElement[],
  key: string,
) => {
  const { params, root, values } = customOf(members);
  if (root) {
    const { [key]: _gone, ...rest } = values;
    writeRoot(scene, root, {
      params: params.filter((param) => param.key !== key),
      values: rest,
    });
  }
};
