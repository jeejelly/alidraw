import React from "react";

import { FONT_FAMILY, getFontString } from "@excalidraw/common";

import { actionToggleBold, actionToggleItalic } from "../actions";
import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { exportToSvg } from "../scene/export";

import { API } from "./helpers/api";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();
const { h } = window;

describe("bold and italic", () => {
  it("are part of the font string", () => {
    const base = { fontSize: 20, fontFamily: FONT_FAMILY.Nunito };
    expect(getFontString(base)).toMatch(/^20px /);
    expect(getFontString({ ...base, fontWeight: 700 })).toMatch(/^700 20px /);
    expect(getFontString({ ...base, fontStyle: "italic" })).toMatch(
      /^italic 20px /,
    );
    expect(
      getFontString({ ...base, fontStyle: "italic", fontWeight: 700 }),
    ).toMatch(/^italic 700 20px /);
    // regular is not spelled out
    expect(
      getFontString({ ...base, fontWeight: 400, fontStyle: "normal" }),
    ).toMatch(/^20px /);
  });

  it("toggle for the whole selection, and the shortcuts reach them", async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
      type: "text",
      text: "one",
      fontSize: 20,
    } as any);
    const b = API.createElement({
      type: "text",
      text: "two",
      fontSize: 20,
      x: 200,
    } as any);
    API.setElements([a, b]);
    API.setSelectedElements([a, b]);
    const text = (id: string) => h.elements.find((e) => e.id === id) as any;
    const width = text(a.id).width;

    act(() => h.app.actionManager.executeAction(actionToggleBold));
    expect(text(a.id).fontWeight).toBe(700);
    expect(text(b.id).fontWeight).toBe(700);
    // the box follows the new font (the measure uses it)
    expect(text(a.id).width).not.toBe(width);
    // all of it is bold: off again, and the property goes away
    act(() => h.app.actionManager.executeAction(actionToggleBold));
    expect(text(a.id).fontWeight).toBe(400);

    // a mixed selection turns on first
    API.updateElement(b, { fontStyle: "italic" } as any);
    act(() => h.app.actionManager.executeAction(actionToggleItalic));
    expect(text(a.id).fontStyle).toBe("italic");
    expect(text(b.id).fontStyle).toBe("italic");

    const key = (k: string) =>
      new KeyboardEvent("keydown", { key: k, ctrlKey: true, bubbles: true });
    expect(actionToggleBold.keyTest!(key("b"))).toBe(true);
    expect(actionToggleItalic.keyTest!(key("I"))).toBe(true);
    expect(actionToggleBold.keyTest!(key("x"))).toBe(false);
  });

  it("survive a reload, odd values are dropped, and the SVG says so", async () => {
    const t = {
      ...API.createElement({
        type: "text",
        text: "hello",
        fontSize: 20,
      } as any),
      fontWeight: 700,
      fontStyle: "italic",
    } as any;
    const [restored] = restoreElements([t], null) as any[];
    expect(restored.fontWeight).toBe(700);
    expect(restored.fontStyle).toBe("italic");
    const [odd] = restoreElements(
      [{ ...t, fontWeight: 5000, fontStyle: "oblique" } as any],
      null,
    ) as any[];
    expect(odd.fontWeight).toBeUndefined();
    expect(odd.fontStyle).toBeUndefined();

    const svg = await exportToSvg(
      [t] as any,
      { exportBackground: false, viewBackgroundColor: "#fff" } as any,
      null,
    );
    const node = svg.querySelector("text")!;
    expect(node.getAttribute("font-weight")).toBe("700");
    expect(node.getAttribute("font-style")).toBe("italic");
  });
});
