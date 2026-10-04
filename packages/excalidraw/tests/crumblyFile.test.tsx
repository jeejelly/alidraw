import fs from "node:fs";
import path from "node:path";

import { getFlowMeta, readFlow, serializeFlow } from "@excalidraw/flow";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
} from "@excalidraw/element/types";

import { loadFromBlob } from "../data/blob";
import { serializeAsJSON } from "../data/json";

const FIXTURES = path.join(process.cwd(), "docs", "fixtures", "crumbly");
const FLOW = "Crumbly";

const readFixture = (name: string) =>
  fs.readFileSync(path.join(FIXTURES, name), "utf8");

const open = async (json: string) => {
  const loaded = await loadFromBlob(
    new Blob([json], { type: "application/json" }),
    null,
    null,
  );
  return { elements: loaded.elements, appState: loaded.appState };
};

const live = (elements: readonly ExcalidrawElement[]) =>
  elements.filter((element) => !element.isDeleted);

const linksOf = (elements: readonly ExcalidrawElement[]) =>
  live(elements).filter(
    (element): element is ExcalidrawArrowElement =>
      element.type === "arrow" && getFlowMeta(element)?.kind === "edge",
  );

describe("crumbly.excalidraw", () => {
  it("opens, with every flow part restored", async () => {
    const { elements } = await open(readFixture("crumbly.excalidraw"));
    expect(live(elements).length).toBeGreaterThan(300);
    const flowIds = new Set(
      live(elements)
        .map((element) => getFlowMeta(element)?.id)
        .filter(Boolean),
    );
    expect([...flowIds]).toEqual([FLOW]);
  });

  it("reads back as the Mermaid flow saved next to it", async () => {
    const { elements } = await open(readFixture("crumbly.excalidraw"));
    const text = serializeFlow(readFlow(elements, FLOW));
    expect(text.trim()).toBe(readFixture("crumbly.mmd").trim());
  });

  it("holds each link once, attached to shapes that exist", async () => {
    const { elements } = await open(readFixture("crumbly.excalidraw"));
    const links = linksOf(elements);
    expect(links).toHaveLength(6);
    const keys = links.map((link) => getFlowMeta(link)!.key);
    expect(new Set(keys).size).toBe(keys.length);
    const byId = new Map(
      live(elements).map((element) => [element.id, element]),
    );
    for (const link of links) {
      expect(byId.has(link.startBinding!.elementId)).toBe(true);
      expect(byId.has(link.endBinding!.elementId)).toBe(true);
    }
  });

  it("saves back to the same structure and opens again unchanged", async () => {
    const first = await open(readFixture("crumbly.excalidraw"));
    const saved = serializeAsJSON(
      live(first.elements),
      first.appState,
      {},
      "local",
    );
    const second = await open(saved);
    expect(second.elements.map(({ id, type }) => [id, type])).toEqual(
      live(first.elements).map(({ id, type }) => [id, type]),
    );
    expect(serializeFlow(readFlow(second.elements, FLOW))).toBe(
      serializeFlow(readFlow(first.elements, FLOW)),
    );
    expect(
      serializeAsJSON(live(second.elements), second.appState, {}, "local"),
    ).toBe(saved);
  });

  it("repairs a save that draws every link twice", async () => {
    const file = JSON.parse(readFixture("crumbly.excalidraw"));
    const links = file.elements.filter(
      (element: ExcalidrawElement) =>
        element.type === "arrow" && getFlowMeta(element)?.kind === "edge",
    );
    // the old shape of the file: copies on top of the originals, with the
    // shapes listing the copies as theirs
    const copies = links.map((link: ExcalidrawElement) => ({
      ...link,
      id: `${link.id}-copy`,
    }));
    file.elements = [...file.elements, ...copies];
    for (const element of file.elements) {
      element.boundElements = element.boundElements?.map(
        (bound: { id: string }) =>
          links.some((link: ExcalidrawElement) => link.id === bound.id)
            ? { ...bound, id: `${bound.id}-copy` }
            : bound,
      );
    }
    const { elements } = await open(JSON.stringify(file));
    const remaining = linksOf(elements);
    expect(remaining).toHaveLength(6);
    expect(remaining.every((link) => link.id.endsWith("-copy"))).toBe(true);
    expect(serializeFlow(readFlow(elements, FLOW)).trim()).toBe(
      readFixture("crumbly.mmd").trim(),
    );
  });
});
