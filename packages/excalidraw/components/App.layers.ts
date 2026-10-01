import { newElementWith, getBoundTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  getLayerId,
  newLayer,
  orderByLayers,
  withLayer,
  type Layer,
} from "../layers";

import type App from "./App";

/**
 * Layers: named containers that own objects. This keeps the scene in line
 * with them: new objects go to the active layer, every layer is a block of the
 * z stack, and the layer operations of the panel (hide, lock, reorder, move
 * objects, restyle all of a layer's objects) live here.
 */
export class AppLayers {
  private busy = false;

  constructor(private app: App) {}

  private get layers(): readonly Layer[] {
    return this.app.state.layers;
  }

  private get activeId(): string {
    const { layers, activeLayerId } = this.app.state;
    return layers.some((l) => l.id === activeLayerId)
      ? activeLayerId!
      : layers[layers.length - 1].id;
  }

  /** the live (not deleted) objects of a layer, bottom to top */
  getObjects = (layerId: string) =>
    this.app.scene
      .getNonDeletedElements()
      .filter(
        (el) =>
          !(el.type === "text" && el.containerId) && getLayerId(el) === layerId,
      );

  /** puts unowned objects in the active layer and the stack in layer order */
  refresh = () => {
    if (this.busy || !this.layers.length) {
      return;
    }
    const scene = this.app.scene;
    const known = new Set(this.layers.map((l) => l.id));
    const active = this.activeId;
    this.busy = true;
    try {
      for (const el of scene.getNonDeletedElements()) {
        if (el.type === "text" && el.containerId) {
          continue;
        }
        const id = getLayerId(el);
        if (id === null || !known.has(id)) {
          scene.mutateElement(el, { customData: withLayer(el, active) });
        }
      }
      const all = scene.getElementsIncludingDeleted();
      const ordered = orderByLayers(all, this.layers, active);
      if (ordered.some((el, i) => el !== all[i])) {
        scene.replaceAllElements(ordered);
      }
    } finally {
      this.busy = false;
    }
  };

  private commit = () => {
    this.app.store.scheduleCapture();
    this.app.setState({});
  };

  private setLayers = (layers: readonly Layer[], extra: object = {}) => {
    this.app.setState({ layers, ...extra }, this.refresh);
  };

  private patch = (id: string, change: Partial<Layer>) =>
    this.setLayers(
      this.layers.map((l) => (l.id === id ? { ...l, ...change } : l)),
    );

  // ---------------------------------------------------------------------------

  add = (name?: string) => {
    let layers = this.layers;
    if (!layers.length) {
      // what is already drawn becomes the first layer
      layers = [newLayer([], "Layer 1")];
      for (const el of this.app.scene.getNonDeletedElements()) {
        if (!(el.type === "text" && el.containerId)) {
          this.app.scene.mutateElement(el, {
            customData: withLayer(el, layers[0].id),
          });
        }
      }
    }
    const layer = newLayer(layers, name);
    this.setLayers([...layers, layer], { activeLayerId: layer.id });
    this.commit();
    return layer;
  };

  rename = (id: string, name: string) =>
    this.patch(id, { name: name.trim() || "Layer" });

  setActive = (id: string) => this.app.setState({ activeLayerId: id });

  toggleCollapsed = (id: string) =>
    this.patch(id, {
      collapsed: !this.layers.find((l) => l.id === id)?.collapsed,
    });

  setVisible = (id: string, visible: boolean) => {
    this.patch(id, { visible });
    if (!visible) {
      // what is hidden cannot stay selected
      const ids = new Set(this.getObjects(id).map((el) => el.id));
      this.app.setState((prev) => ({
        selectedElementIds: Object.fromEntries(
          Object.entries(prev.selectedElementIds).filter(([k]) => !ids.has(k)),
        ),
      }));
    }
  };

  /** locking a layer locks its objects (the editor's own lock) */
  setLocked = (id: string, locked: boolean) => {
    const scene = this.app.scene;
    for (const el of this.getObjects(id)) {
      scene.mutateElement(el, { locked });
      const text = getBoundTextElement(el, scene.getNonDeletedElementsMap());
      if (text) {
        scene.mutateElement(text, { locked });
      }
    }
    this.patch(id, { locked });
    this.commit();
  };

  /** moves a layer to a position in the stack (0 is the bottom) */
  move = (id: string, index: number) => {
    const from = this.layers.findIndex((l) => l.id === id);
    if (from < 0) {
      return;
    }
    const next = [...this.layers];
    const [layer] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, index)), 0, layer);
    this.setLayers(next);
    this.commit();
  };

  /** deletes the layer and, as it owns them, its objects */
  remove = (id: string) => {
    const owned = new Set(this.getObjects(id).map((el) => el.id));
    const rest = this.layers.filter((l) => l.id !== id);
    const scene = this.app.scene;
    scene.replaceAllElements(
      scene.getElementsIncludingDeleted().map((el) => {
        const container =
          el.type === "text" && el.containerId ? el.containerId : null;
        return owned.has(el.id) || (container && owned.has(container))
          ? newElementWith(el, { isDeleted: true })
          : el;
      }),
    );
    this.app.setState(
      (prev) => ({
        layers: rest,
        activeLayerId:
          prev.activeLayerId === id
            ? rest[rest.length - 1]?.id ?? null
            : prev.activeLayerId,
        selectedElementIds: Object.fromEntries(
          Object.entries(prev.selectedElementIds).filter(
            ([k]) => !owned.has(k),
          ),
        ),
      }),
      this.refresh,
    );
    this.commit();
  };

  /** moves objects into a layer, on top of its block */
  moveObjects = (ids: readonly string[], layerId: string) => {
    const scene = this.app.scene;
    const set = new Set(ids);
    const moved: ExcalidrawElement[] = [];
    const kept: ExcalidrawElement[] = [];
    for (const el of scene.getElementsIncludingDeleted()) {
      if (set.has(el.id)) {
        const next = newElementWith(el, {
          customData: withLayer(el, layerId),
          locked:
            this.layers.find((l) => l.id === layerId)?.locked ?? el.locked,
        });
        moved.push(next);
      } else {
        kept.push(el);
      }
    }
    scene.replaceAllElements([...kept, ...moved]);
    this.setActive(layerId);
    this.refresh();
    this.commit();
  };

  /** selects every object of the layer (Illustrator's selection square) */
  select = (id: string, additive = false) => {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer || !layer.visible) {
      return;
    }
    this.app.setState((prev) => ({
      selectedElementIds: {
        ...(additive ? prev.selectedElementIds : {}),
        ...Object.fromEntries(this.getObjects(id).map((el) => [el.id, true])),
      },
      selectedGroupIds: {},
      editingPath: null,
      activeLayerId: id,
    }));
  };

  /** the layer-level style: one change restyles every object of the layer */
  setStyle = (
    id: string,
    style: { strokeColor?: string; backgroundColor?: string; opacity?: number },
  ) => {
    for (const el of this.getObjects(id)) {
      this.app.scene.mutateElement(el, style);
    }
    this.commit();
  };

  /** the colour all of a layer's objects share, or null when they differ */
  getSharedStyle = (id: string, key: "strokeColor" | "backgroundColor") => {
    const values = new Set(this.getObjects(id).map((el) => el[key]));
    return values.size === 1 ? [...values][0] : null;
  };
}
