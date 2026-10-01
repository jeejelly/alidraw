import React from "react";

import { setFileSaveProvider, fileSave } from "../data/filesystem";
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
