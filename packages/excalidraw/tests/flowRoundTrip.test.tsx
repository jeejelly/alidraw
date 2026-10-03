import React from "react";

import {
  applyFlow,
  listFlows,
  parseFlow,
  readFlow,
  serializeFlow,
  type FlowGraph,
} from "@excalidraw/flow";

import { setFileOpenProvider, setFileSaveProvider } from "../data/filesystem";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { liveElements, resetTestState } from "./helpers/fixtures";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  screen,
  unmountComponent,
  waitFor,
} from "./test-utils";

unmountComponent();

const handle = window.h;

beforeEach(resetTestState);

const COMPLEX = `%%{init: {"theme": "forest"}}%%
flowchart LR
  accTitle: Checkout
  subgraph shop["Shop"]
    direction TB
    add["Add"]:::primary
    pay{"Pay?"}:::primary:::wide
    list[("Orders")]
  end
  user(["Customer"]) --> add
  add -->|"go"| pay
  pay -- yes --> done((("Done")))
  pay -. no .-> add
  pay ==> list
  add --x user
  done o--o list
  done ~~~ user
  list ----> user
  classDef primary fill:#e0449b,stroke:#333
  class list,done wide
  linkStyle 0 stroke:#f00
`;

const draw = (text: string) => {
  const { graph, issues } = parseFlow(text);
  expect(issues.filter((issue) => !issue.warn)).toEqual([]);
  act(() => {
    applyFlow(handle.app.scene, "Flow", graph, { x: 100, y: 100 });
  });
  return graph;
};

const read = (layout = false): FlowGraph =>
  readFlow(handle.app.scene.getElementsIncludingDeleted(), "Flow", { layout });

/** same steps and links, whatever order the canvas lists them in */
const normalized = (graph: FlowGraph) => ({
  ...graph,
  nodes: [...graph.nodes].sort((first, second) =>
    first.key.localeCompare(second.key),
  ),
  screens: [...graph.screens].sort((first, second) =>
    first.key.localeCompare(second.key),
  ),
  edges: [...graph.edges].sort((first, second) =>
    `${first.from}>${first.to}${first.style}`.localeCompare(
      `${second.from}>${second.to}${second.style}`,
    ),
  ),
});

describe("text → canvas → text", () => {
  it("keeps shapes, ends, lengths, classes, directions and what is not drawn", async () => {
    await render(<Excalidraw />);
    const before = draw(COMPLEX);
    const after = read();
    expect(normalized(after)).toEqual(normalized(before));
  });

  it("is stable: drawing what was read changes nothing", async () => {
    await render(<Excalidraw />);
    draw(COMPLEX);
    const first = serializeFlow(read(true), { layout: true });
    act(() => {
      applyFlow(handle.app.scene, "Flow", parseFlow(first).graph, {
        x: 100,
        y: 100,
      });
    });
    expect(serializeFlow(read(true), { layout: true })).toBe(first);
  });

  it("restores the layout from the comments in a new scene", async () => {
    await render(<Excalidraw />);
    draw(COMPLEX);
    const exported = serializeFlow(read(true), { layout: true });
    const positions = new Map(
      read(true).nodes.map((node) => [node.key, node.at]),
    );
    act(() => {
      handle.app.scene.replaceAllElements(
        handle.app.scene
          .getElementsIncludingDeleted()
          .map((element) => ({ ...element, isDeleted: true })),
      );
    });
    expect(liveElements()).toHaveLength(0);
    draw(exported);
    for (const node of read(true).nodes) {
      const wanted = positions.get(node.key)!;
      expect(node.at).toMatchObject({ x: wanted.x, y: wanted.y });
    }
  });

  it("draws a cross or a circle end as such, and reads a hand-drawn one back", async () => {
    await render(<Excalidraw />);
    draw("flowchart LR\n  a --x b\n  b --o c\n");
    const arrows = liveElements().filter((element) => element.type === "arrow");
    expect(arrows.map((arrow: any) => arrow.endArrowhead).sort()).toEqual([
      "bar",
      "circle_outline",
    ]);
    expect(read().edges.map((edge) => edge.headEnd)).toEqual(
      expect.arrayContaining(["cross", "circle"]),
    );
  });
});

describe("Markdown and Mermaid files in the flow panel", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
    setFileOpenProvider(null);
    setFileSaveProvider(null);
  });

  const open = async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    fireEvent.click(screen.getByTestId("inspector-tab-flow"));
  };
  const saved: { name: string; extension: string; text: string }[] = [];
  const captureSaves = () => {
    saved.length = 0;
    setFileSaveProvider(async (blob, { name, extension }) => {
      saved.push({ name, extension, text: await blobText(await blob) });
      return null;
    });
  };
  const blobText = (blob: Blob) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
  const offerFile = (name: string, text: string) =>
    setFileOpenProvider(async () => [new File([text], name)]);

  it("imports every flowchart of a Markdown file as a flow", async () => {
    await open();
    offerFile(
      "notes.md",
      `## Shop\n\n\`\`\`mermaid\nflowchart TD\n  a[(Orders)] --x b\n\`\`\`\n\n## Talk\n\n\`\`\`mermaid\nsequenceDiagram\n  A->>B: hi\n\`\`\`\n\n## Pay\n\n\`\`\`mermaid\nflowchart LR\n  c --> d\n\`\`\`\n`,
    );
    fireEvent.click(screen.getByTestId("flow-import"));
    await waitFor(() =>
      expect(listFlows(handle.elements)).toEqual(["Shop", "Pay"]),
    );
    expect(screen.getByTestId("flow-files-message").textContent).toContain("2");
  });

  it("says when a file holds no flowchart", async () => {
    await open();
    offerFile("empty.md", "# Nothing here\n");
    fireEvent.click(screen.getByTestId("flow-import"));
    await waitFor(() =>
      expect(screen.getByTestId("flow-files-message").textContent).toContain(
        "empty.md",
      ),
    );
    expect(listFlows(handle.elements)).toEqual([]);
  });

  it("exports Markdown and Mermaid that import back to the same drawing", async () => {
    await open();
    captureSaves();
    act(() => {
      applyFlow(handle.app.scene, "Flow", parseFlow(COMPLEX).graph, {
        x: 100,
        y: 100,
      });
    });
    const original = serializeFlow(read(true), { layout: true });
    fireEvent.click(screen.getByTestId("flow-export"));
    fireEvent.click(screen.getByTestId("flow-export-markdown"));
    await waitFor(() => expect(saved).toHaveLength(1));
    fireEvent.click(screen.getByTestId("flow-export"));
    fireEvent.click(screen.getByTestId("flow-export-mermaid"));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved.map((file) => file.extension)).toEqual(["md", "mmd"]);
    expect(saved[1].text).toBe(original);

    // the Markdown draws the same flow again, under another name
    offerFile("flows.md", saved[0].text);
    fireEvent.click(screen.getByTestId("flow-import"));
    await waitFor(() => expect(listFlows(handle.elements)).toHaveLength(2));
    const copy = listFlows(handle.elements).find((id) => id !== "Flow")!;
    expect(
      serializeFlow(
        readFlow(handle.app.scene.getElementsIncludingDeleted(), copy, {
          layout: true,
        }),
        { layout: true },
      ),
    ).toBe(original);
  });
});
