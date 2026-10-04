import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import React from "react";

import { STORAGE_KEYS } from "../app_constants";
import {
  DAMAGED_SCENE_KEY,
  loadStartupScene,
  recoverFromStartupCrash,
} from "../data/startupRecovery";

const { h } = window;

const toastOf = (scene: ReturnType<typeof loadStartupScene>["scene"]) =>
  (scene.appState?.toast?.message ?? null) as string | null;

const store = (elements: string, state = "{}") => {
  localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS, elements);
  localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE, state);
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("starting with a bad stored scene", () => {
  it("opens a good scene as it is, with no notice", () => {
    store(JSON.stringify([API.createElement({ type: "rectangle" })]));
    const { scene } = loadStartupScene();
    expect(scene.elements).toHaveLength(1);
    expect(toastOf(scene)).toBeNull();
    expect(localStorage.getItem(DAMAGED_SCENE_KEY)).toBeNull();
  });

  it("starts blank with a notice when the scene is not valid JSON", () => {
    store("{not json");
    const { scene } = loadStartupScene();
    expect(scene.elements).toEqual([]);
    expect(toastOf(scene)).toContain("damaged");
  });

  it("starts blank with a notice when the scene is not a list of elements", () => {
    store(JSON.stringify({ not: "a list" }));
    const { scene } = loadStartupScene();
    expect(scene.elements).toEqual([]);
    expect(toastOf(scene)).toContain("damaged");
  });

  it("starts blank with a notice when the app state cannot be read", () => {
    store("[]", "{broken");
    expect(toastOf(loadStartupScene().scene)).toContain("damaged");
  });

  it("keeps the damaged scene aside and clears the live copy", () => {
    store("{not json", '{"theme":"dark"}');
    loadStartupScene();
    const kept = JSON.parse(localStorage.getItem(DAMAGED_SCENE_KEY)!);
    expect(kept.elements).toBe("{not json");
    expect(kept.appState).toBe('{"theme":"dark"}');
    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
    ).toBeNull();
    // the next start is a plain blank one
    expect(toastOf(loadStartupScene().scene)).toBeNull();
  });
});

describe("a crash while the editor starts", () => {
  const reload = vi.fn();
  const realLocation = window.location;

  beforeEach(() => {
    reload.mockClear();
    Object.defineProperty(window, "location", {
      value: { ...realLocation, reload },
      configurable: true,
    });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: realLocation,
      configurable: true,
    });
  });

  it("sets the scene aside and reloads, then says so", () => {
    store(JSON.stringify([API.createElement({ type: "rectangle" })]));
    expect(recoverFromStartupCrash()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DAMAGED_SCENE_KEY)).not.toBeNull();
    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
    ).toBeNull();
    expect(toastOf(loadStartupScene().scene)).toContain("crashed");
  });

  it("does not loop: a second crash in the same session is left alone", () => {
    store(JSON.stringify([API.createElement({ type: "rectangle" })]));
    expect(recoverFromStartupCrash()).toBe(true);
    store(JSON.stringify([API.createElement({ type: "rectangle" })]));
    expect(recoverFromStartupCrash()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there is no stored scene to blame", () => {
    expect(recoverFromStartupCrash()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("the editor given a scene it cannot restore", () => {
  it("opens blank with a notice instead of staying empty and loading", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await render(
      <Excalidraw
        initialData={{
          get elements(): never {
            throw new Error("damaged elements");
          },
        }}
      />,
    );
    await waitFor(() => expect(h.state.isLoading).toBe(false));
    expect(h.elements).toHaveLength(0);
    expect(h.state.toast?.message).toContain("damaged");
    consoleError.mockRestore();
  });
});
