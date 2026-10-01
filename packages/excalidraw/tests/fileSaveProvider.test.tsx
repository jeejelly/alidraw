import React from "react";

import {
  setFileSaveProvider,
  setHostCapabilities,
  fileSave,
} from "../data/filesystem";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import {
  fireEvent,
  render,
  screen,
  unmountComponent,
  waitFor,
} from "./test-utils";

unmountComponent();

const { h } = window;

afterEach(() => setFileSaveProvider(null));

describe("a host that takes over saving scene files", () => {
  it("is asked instead of the file dialog, for scenes only", async () => {
    const calls: string[] = [];
    const handle = { kind: "file", name: "x.excalidraw" } as any;
    setFileSaveProvider(async (_blob, opts) => {
      calls.push(`${opts.name}.${opts.extension}`);
      return handle;
    });
    expect(
      await fileSave(new Blob(["{}"]), {
        name: "Idea",
        extension: "excalidraw",
        description: "d",
      }),
    ).toBe(handle);
    expect(calls).toEqual(["Idea.excalidraw"]);
  });

  it("Export saves straight away: no dialog to click through", async () => {
    const calls: string[] = [];
    setFileSaveProvider(async (_blob, opts) => {
      calls.push(opts.name);
      return { kind: "file", name: `${opts.name}.excalidraw` } as any;
    });
    await render(<Excalidraw />);
    API.setElements([API.createElement({ type: "rectangle" })]);
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByTestId("json-export-button"));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(h.state.openDialog).toBeNull();
    await waitFor(() =>
      expect(h.state.fileHandle).toMatchObject({
        name: expect.stringContaining(".excalidraw"),
      }),
    );
  });

  it("without a host, Export opens its dialog as before", async () => {
    await render(<Excalidraw />);
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByTestId("json-export-button"));
    expect(h.state.openDialog).toMatchObject({ name: "jsonExport" });
  });
});

describe("image storage in the inspector", () => {
  afterEach(() => setHostCapabilities({ linkedImages: false }));

  const image = () =>
    API.createElement({
      type: "image",
      fileId: "f1" as any,
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });

  it("is only offered when the host can keep images as linked files", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const img = image();
    API.setElements([img]);
    API.setSelectedElements([img]);
    expect(screen.queryByTestId("inspector-image-storage")).toBeNull();
  });

  it("an image can be set to embedded or a linked file, and back to the default", async () => {
    setHostCapabilities({ linkedImages: true });
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const img = image();
    API.setElements([img]);
    API.setSelectedElements([img]);
    expect(
      screen.getByTestId("image-storage-default").getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByTestId("image-storage-linked"));
    expect(h.elements[0].customData?.imageStorage).toBe("linked");
    expect(
      screen.getByTestId("image-storage-linked").getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByTestId("image-storage-embedded"));
    expect(h.elements[0].customData?.imageStorage).toBe("embedded");
    fireEvent.click(screen.getByTestId("image-storage-default"));
    expect(h.elements[0].customData?.imageStorage).toBe("default");
  });

  it("not shown for other shapes", async () => {
    setHostCapabilities({ linkedImages: true });
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const r = API.createElement({ type: "rectangle" });
    API.setElements([r]);
    API.setSelectedElements([r]);
    expect(screen.queryByTestId("inspector-image-storage")).toBeNull();
  });
});
