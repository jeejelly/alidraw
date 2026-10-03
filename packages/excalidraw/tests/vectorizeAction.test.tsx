import React from "react";

import { actionVectorizeImage } from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render, unmountComponent, waitFor } from "./test-utils";

vi.mock("@excalidraw/vector", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@excalidraw/vector")>();
  const width = 50;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const inside = (x - 25) ** 2 + (y - 25) ** 2 < 15 ** 2;
      data.set(
        inside ? [220, 40, 40, 255] : [250, 250, 250, 255],
        (y * width + x) * 4,
      );
    }
  }
  return {
    ...actual,
    loadPixels: async () => ({ width, height: width, data }),
  };
});

unmountComponent();
const handle = window.h;

describe("the vectorize action", () => {
  it("puts the traced shapes next to the picture, leaves it alone, and selects them", async () => {
    await render(<Excalidraw />);
    const image = API.createElement({
      type: "image",
      x: 10,
      y: 20,
      width: 100,
      height: 100,
      fileId: "f1" as any,
    } as any);
    API.setElements([image]);
    act(() => {
      handle.app.addFiles([
        {
          id: "f1" as any,
          mimeType: "image/png",
          dataURL: "data:image/png;base64,AAAA" as any,
          created: 1,
        },
      ]);
    });
    API.setSelectedElements([image]);
    await act(async () => {
      await handle.app.actionManager.executeAction(actionVectorizeImage, "ui", {
        colors: 3,
      });
    });
    // tracing is asynchronous (the tracer loads on first use)
    await waitFor(() =>
      expect(handle.elements.some((element) => element.type === "path")).toBe(
        true,
      ),
    );
    const live = handle.elements.filter((element) => !element.isDeleted);
    const paths = live.filter((element) => element.type === "path");
    expect(paths.length).toBeGreaterThanOrEqual(2);
    // the picture is untouched, the shapes stand to its right, same size
    expect(live.find((element) => element.id === image.id)).toMatchObject({
      x: 10,
      y: 20,
    });
    const xs = paths.flatMap((element) => [
      element.x,
      element.x + element.width,
    ]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(10 + 100 + 24 - 8);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(112);
    expect(Object.keys(handle.state.selectedElementIds).sort()).toEqual(
      paths.map((path) => path.id).sort(),
    );
  });
});
