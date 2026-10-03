import {
  flowsFromDocument,
  flowsFromMarkdown,
  flowsToMarkdown,
  parseFlow,
  serializeFlow,
} from "@excalidraw/flow";

const FLOW_A = `flowchart TD
  subgraph home["Home"]
    buy["Buy"]
  end
  buy -->|"pay"| ok(["Done"])
  classDef x fill:#f00
`;
const FLOW_B = "flowchart LR\n  a[(db)] --x b{{hex}}\n";

describe("flows in Markdown", () => {
  const MARKDOWN = `# Notes

Some words.

## Checkout

\`\`\`mermaid
${FLOW_A}\`\`\`

A sequence diagram is not a flow:

### Talk

\`\`\`mermaid
sequenceDiagram
  A->>B: hi
\`\`\`

~~~mermaid
${FLOW_B}~~~

\`\`\`js
flowchart TD
\`\`\`
`;

  it("finds each flowchart block, named after its heading, and skips the rest", () => {
    const flows = flowsFromMarkdown(MARKDOWN);
    expect(flows.map((flow) => flow.name)).toEqual(["Checkout", "Talk"]);
    expect(flows[0].text).toBe(FLOW_A);
    expect(flows[1].text).toBe(FLOW_B);
  });

  it("names unnamed blocks and reads Mermaid files as one flow", () => {
    expect(
      flowsFromMarkdown("```mermaid\ngraph TD\n a-->b\n```").map((f) => f.name),
    ).toEqual(["Flow 1"]);
    expect(flowsFromDocument(FLOW_B, "orders.mmd")).toEqual([
      { name: "orders", text: FLOW_B },
    ]);
    expect(flowsFromDocument("hello", "x.txt")).toEqual([]);
  });

  it("round-trips several flows, layout included", () => {
    const a = parseFlow(FLOW_A).graph;
    const b = parseFlow(FLOW_B).graph;
    a.nodes[0].at = { x: 5, y: 6, w: 100, h: 50 };
    const markdown = flowsToMarkdown([
      { name: "Checkout", graph: a },
      { name: "Orders", graph: b },
    ]);
    const back = flowsFromMarkdown(markdown);
    expect(back.map((flow) => flow.name)).toEqual(["Checkout", "Orders"]);
    expect(parseFlow(back[0].text).graph).toEqual(a);
    expect(parseFlow(back[1].text).graph).toEqual(b);
    expect(back[0].text).toBe(serializeFlow(a, { layout: true }));
  });
});
