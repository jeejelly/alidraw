import { parseFlow, serializeFlow } from "@excalidraw/flow";

const roundTrip = (text: string) => {
  const first = parseFlow(text);
  const written = serializeFlow(first.graph, { layout: true });
  const second = parseFlow(written);
  return { first, written, second };
};

/** parse → write → parse gives the same graph, and writing again gives the same text */
const expectLossless = (text: string) => {
  const { first, written, second } = roundTrip(text);
  expect(first.issues).toEqual([]);
  expect(second.issues).toEqual([]);
  expect(second.graph).toEqual(first.graph);
  expect(serializeFlow(second.graph, { layout: true })).toBe(written);
  return first.graph;
};

describe("every Mermaid node shape survives", () => {
  const SHAPES = [
    'a["rect"]',
    'a("round")',
    'a(["stadium"])',
    'a[["subroutine"]]',
    'a[("cylinder")]',
    'a(("circle"))',
    'a((("double")))',
    'a{"diamond"}',
    'a{{"hexagon"}}',
    'a[/"parallelogram"/]',
    'a[\\"parallelogram alt"\\]',
    'a[/"trapezoid"\\]',
    'a[\\"trapezoid alt"/]',
    'a>"asymmetric"]',
  ];
  it.each(SHAPES)("%s", (node) => {
    const graph = expectLossless(`flowchart TD\n  ${node}\n`);
    expect(graph.nodes).toHaveLength(1);
  });

  it("reads the unquoted spellings too", () => {
    const { graph } = parseFlow(
      "flowchart TD\n  a[(db)] --> b([ok]) --> c{{prep}} --> d[/in/] --> e[/x\\]",
    );
    expect(graph.nodes.map((node) => node.form ?? node.shape)).toEqual([
      "cylinder",
      "stadium",
      "hexagon",
      "parallelogram",
      "trapezoid",
    ]);
  });

  it("reads the shape block of Mermaid 11 and keeps the form", () => {
    const graph = expectLossless(
      'flowchart TD\n  a@{ shape: doc, label: "Report" }\n  b@{ shape: cyl, label: "Users" }\n  c@{ shape: diam, label: "Ok?" }\n  a --> b --> c\n',
    );
    expect(graph.nodes.map((node) => [node.shape, node.form])).toEqual([
      ["rect", "document"],
      ["rect", "cylinder"],
      ["diamond", undefined],
    ]);
  });
});

describe("every kind of link survives", () => {
  const LINKS = [
    "-->",
    "---",
    "-.->",
    "-.-",
    "==>",
    "===",
    "--x",
    "--o",
    "<-->",
    "x--x",
    "o--o",
    "---->",
    "-..->",
    "====>",
    "~~~",
    '-->|"yes"|',
    '-.->|"later"|',
    '==>|"now"|',
    '<-->|"both"|',
  ];
  it.each(LINKS)("a %s b", (link) => {
    const graph = expectLossless(`flowchart LR\n  a ${link} b\n`);
    expect(graph.edges).toHaveLength(1);
  });

  it("reads the labelled spellings and keeps the length", () => {
    const { graph } = parseFlow(
      "flowchart LR\n  a -- one --> b\n  b -. two .-> c\n  c == three ==> d\n  d ----> e\n  e -...-> f",
    );
    expect(
      graph.edges.map((edge) => [edge.label, edge.style, edge.length ?? 0]),
    ).toEqual([
      ["one", "solid", 0],
      ["two", "dashed", 0],
      ["three", "thick", 0],
      ["", "solid", 2],
      ["", "dashed", 2],
    ]);
  });

  it("keeps the kind of end", () => {
    const { graph } = parseFlow(
      "flowchart LR\n  a --x b\n  c --o d\n  e o--x f",
    );
    expect(graph.edges.map((edge) => [edge.headEnd, edge.tailEnd])).toEqual([
      ["cross", undefined],
      ["circle", undefined],
      ["cross", "circle"],
    ]);
  });
});

describe("what Mermaid has and the canvas does not draw is kept", () => {
  const COMPLEX = `%%{init: {"theme": "forest"}}%%
flowchart LR
  accTitle: Checkout
  accDescr {
    How a basket becomes an order
  }
  subgraph shop["Shop"]
    direction TB
    subgraph cart["Cart"]
      add["Add"]:::primary
      pay{"Pay?"}:::primary:::wide
    end
    list[("Orders")]
  end
  user(["Customer"]) --> add
  add -->|"go"| pay
  pay -- yes --> done((("Done")))
  pay -. no .-> add
  pay ==> list
  done ~~~ user
  classDef primary fill:#e0449b,stroke:#333
  classDef wide stroke-width:4px
  class list,done wide
  style user fill:#fff
  linkStyle 0 stroke:#f00
  click add "https://example.com" "open"
  %% a plain comment
`;

  it("round-trips the whole diagram", () => {
    const graph = expectLossless(COMPLEX);
    expect(graph.preamble).toEqual(['%%{init: {"theme": "forest"}}%%']);
    expect(graph.trailer).toEqual([
      "accTitle: Checkout",
      "accDescr {\n    How a basket becomes an order\n  }".replace(
        /\n\s*/g,
        "\n",
      ),
      "classDef primary fill:#e0449b,stroke:#333",
      "classDef wide stroke-width:4px",
      "class list,done wide",
      "style user fill:#fff",
      "linkStyle 0 stroke:#f00",
      'click add "https://example.com" "open"',
      "%% a plain comment",
    ]);
    expect(graph.screens).toEqual([
      { key: "shop", label: "Shop", direction: "TD" },
      { key: "cart", label: "Cart", parent: "shop" },
    ]);
    expect(graph.nodes.find((node) => node.key === "pay")?.classes).toEqual([
      "primary",
      "wide",
    ]);
    expect(graph.edges.map((edge) => edge.style)).toEqual([
      "solid",
      "solid",
      "solid",
      "dashed",
      "thick",
      "invisible",
    ]);
  });

  it("writes each statement once and in order", () => {
    const { written } = roundTrip(COMPLEX);
    expect(
      written.startsWith('%%{init: {"theme": "forest"}}%%\nflowchart LR'),
    ).toBe(true);
    expect(written.match(/classDef/g)).toHaveLength(2);
    expect(written.indexOf("linkStyle")).toBeGreaterThan(
      written.indexOf("pay ==>"),
    );
  });
});

describe("labels", () => {
  it("keeps quotes, line breaks, brackets and entities", () => {
    const graph = expectLossless(
      'flowchart TD\n  a["She said #quot;hi#quot;<br/>then left"]\n  b["array[0] and (x)"]\n  c["a #35; b"]\n',
    );
    expect(graph.nodes.map((node) => node.label)).toEqual([
      'She said "hi"\nthen left',
      "array[0] and (x)",
      "a # b",
    ]);
  });
});

describe("the layout comments", () => {
  it("are written only when asked, are valid Mermaid, and come back", () => {
    const { graph } = parseFlow(
      "flowchart TD\n  subgraph s[Screen]\n    a[A]\n  end\n  b[B]\n  a --> b\n",
    );
    graph.nodes[0].at = { x: 10.25, y: 20, w: 120, h: 60 };
    graph.nodes[1].at = { x: -40, y: 300, w: 120, h: 60 };
    graph.screens[0].at = { x: 0, y: 0, w: 200, h: 140 };
    expect(serializeFlow(graph)).not.toContain("@layout");
    const text = serializeFlow(graph, { layout: true });
    expect(text).toContain("%% @layout a 10.3 20 120 60");
    const again = parseFlow(text).graph;
    expect(again.nodes[1].at).toEqual({ x: -40, y: 300, w: 120, h: 60 });
    expect(again.screens[0].at).toEqual({ x: 0, y: 0, w: 200, h: 140 });
    // the same graph without layout comments reads as before
    expect(
      parseFlow(serializeFlow(again)).graph.nodes.map((node) => node.at),
    ).toEqual([undefined, undefined]);
  });
});

describe("ports", () => {
  const TEXT = `flowchart TD
  d{"Paid?"}
  a["A"]
  b["B"]
  d -- yes --> a
  d --> b
%% @ports d in:0.5:0 yes:0.5:1 maybe:1:0.5
%% @link 1 maybe -
`;
  it("are kept in the layout comments of the own format only", () => {
    const { graph, issues } = parseFlow(TEXT);
    expect(issues).toEqual([]);
    expect(graph.nodes[0].ports).toEqual([
      { name: "in", at: [0.5, 0] },
      { name: "yes", at: [0.5, 1] },
      { name: "maybe", at: [1, 0.5] },
    ]);
    expect(graph.edges.map((edge) => edge.fromPort)).toEqual([
      undefined,
      "maybe",
    ]);
    expect(serializeFlow(graph)).not.toContain("@");
    const written = serializeFlow(graph, { layout: true });
    expect(written).toContain("%% @link 1 maybe -");
    expect(parseFlow(written).graph).toEqual(graph);
  });
});
