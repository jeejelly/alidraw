import React from "react";

import {
  DP_DENSITY,
  FONT_FAMILY,
  fontSizeToPx,
  getFontFamilyString,
  getFontString,
} from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { actionChangeFontSizeInput, actionChangeLocalFont } from "../actions";
import { parseFontSize } from "../actions/actionTypography";
import { restoreElements } from "../data/restore";
import { filterFontFamilies } from "../fonts/localFonts";
import { Excalidraw } from "../index";

import { resetTestState } from "./helpers/fixtures";
import { API } from "./helpers/api";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const handle = window.h;

beforeEach(resetTestState);

describe("font strings", () => {
  it("a local family comes first and the bundled family stays as fallback", () => {
    expect(
      getFontFamilyString({
        fontFamily: FONT_FAMILY.Helvetica,
        fontFamilyName: "Fira Sans",
      }),
    ).toMatch(/^"Fira Sans", Helvetica/);
    expect(
      getFontString({
        fontSize: 18,
        fontFamily: FONT_FAMILY.Helvetica,
        fontFamilyName: 'Bad"Name',
      }),
    ).toMatch(/^18px "BadName", Helvetica/);
    expect(getFontFamilyString({ fontFamily: FONT_FAMILY.Helvetica })).toBe(
      getFontFamilyString({
        fontFamily: FONT_FAMILY.Helvetica,
        fontFamilyName: null,
      }),
    );
  });

  it("dp and px render at the same size at 1x density", () => {
    expect(DP_DENSITY).toBe(1);
    expect(fontSizeToPx(24, "dp")).toBe(fontSizeToPx(24, "px"));
    expect(fontSizeToPx(24, undefined)).toBe(24);
  });
});

describe("numeric font size", () => {
  it("parses and clamps typed values", () => {
    expect(parseFontSize("23")).toBe(23);
    expect(parseFontSize(" 12,5 ")).toBe(12.5);
    expect(parseFontSize("0")).toBe(1);
    expect(parseFontSize("99999")).toBe(1000);
    expect(parseFontSize("abc")).toBeNull();
    expect(parseFontSize("")).toBeNull();
  });

  it("filters installed fonts", () => {
    expect(
      filterFontFamilies(["Arial", "Fira Sans", "Firefly"], "fir"),
    ).toEqual(["Fira Sans", "Firefly"]);
  });
});

describe("text typography in the editor", () => {
  const setup = async () => {
    await render(<Excalidraw />);
    const text = API.createElement({ type: "text", text: "hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);
    return text;
  };
  const current = () => handle.elements[0] as ExcalidrawTextElement;

  it("accepts any typed size, not only the presets", async () => {
    await setup();
    API.executeAction(actionChangeFontSizeInput, { size: 23 });
    expect(current().fontSize).toBe(23);
    expect(handle.state.currentItemFontSize).toBe(23);
  });

  it("records the unit on the text", async () => {
    await setup();
    API.executeAction(actionChangeFontSizeInput, { unit: "dp" });
    expect(current().fontUnit).toBe("dp");
    expect(handle.state.currentItemFontUnit).toBe("dp");
    API.executeAction(actionChangeFontSizeInput, { unit: "px" });
    expect(current().fontUnit).toBe("px");
  });

  it("a local font is set on the text and remeasured", async () => {
    await setup();
    API.executeAction(actionChangeLocalFont, "Fira Sans");
    expect(current().fontFamilyName).toBe("Fira Sans");
    expect(handle.state.currentItemFontFamilyName).toBe("Fira Sans");
    // the bundled family is kept as the fallback
    expect(current().fontFamily).toBeDefined();
    API.executeAction(actionChangeLocalFont, null);
    expect(current().fontFamilyName ?? null).toBeNull();
  });
});

describe("typography in files", () => {
  it("round-trips the local font and unit, dropping junk", () => {
    const text = API.createElement({ type: "text", text: "x" });
    const [ok] = restoreElements(
      [{ ...text, fontFamilyName: "  Fira Sans ", fontUnit: "dp" } as any],
      null,
    ) as ExcalidrawTextElement[];
    expect(ok.fontFamilyName).toBe("Fira Sans");
    expect(ok.fontUnit).toBe("dp");

    const [bad] = restoreElements(
      [{ ...text, fontFamilyName: 42, fontUnit: "em" } as any],
      null,
    ) as ExcalidrawTextElement[];
    expect(bad.fontFamilyName).toBeUndefined();
    expect(bad.fontUnit).toBeUndefined();
  });

  it("a file without them opens unchanged", () => {
    const text = API.createElement({ type: "text", text: "x" });
    const [el] = restoreElements([text], null) as ExcalidrawTextElement[];
    expect("fontFamilyName" in el).toBe(false);
    expect("fontUnit" in el).toBe(false);
  });
});
