import { parseFlow, serializeFlow, slugKey } from "../flow/flowGraph";

describe("flow text", () => {
  it("reads nodes, shapes, labelled links and styles", () => {
    const { graph, issues } = parseFlow(`flowchart LR
      A[Idea] --> B(Diagram)
      B --> C{Is it clear?}
      C -- Yes --> D((Share))
      C -->|No| B
      D -.-> E
      E ==> A`);
    expect(issues).toEqual([]);
    expect(graph.direction).toBe("LR");
    expect(graph.nodes.map((n) => [n.key, n.label, n.shape])).toEqual([
      ["A", "Idea", "rect"],
      ["B", "Diagram", "round"],
      ["C", "Is it clear?", "diamond"],
      ["D", "Share", "ellipse"],
      ["E", "E", "rect"],
    ]);
    expect(
      graph.edges.map((e) => [e.from, e.to, e.label, e.style, e.head]),
    ).toEqual([
      ["A", "B", "", "solid", true],
      ["B", "C", "", "solid", true],
      ["C", "D", "Yes", "solid", true],
      ["C", "B", "No", "solid", true],
      ["D", "E", "", "dashed", true],
      ["E", "A", "", "thick", true],
    ]);
  });

  it("reads chains, groups, open and two-way links", () => {
    const { graph, issues } = parseFlow(`graph TB
      a --> b & c --> d
      d --- e
      e <--> f`);
    expect(issues).toEqual([]);
    expect(graph.direction).toBe("TD");
    expect(graph.edges.map((e) => `${e.from}>${e.to}`)).toEqual([
      "a>b",
      "a>c",
      "b>d",
      "c>d",
      "d>e",
      "e>f",
    ]);
    expect(graph.edges[4].head).toBe(false);
    expect(graph.edges[5]).toMatchObject({ head: true, tail: true });
  });

  it("puts nodes in the subgraph where they appear", () => {
    const { graph, issues } = parseFlow(`flowchart TD
      subgraph cart["Cart screen"]
        pay["Pay"]
        back["Back"]
      end
      subgraph done[Done]
        ok["Thanks"]
      end
      pay -->|click| ok`);
    expect(issues).toEqual([]);
    expect(graph.screens).toEqual([
      { key: "cart", label: "Cart screen" },
      { key: "done", label: "Done" },
    ]);
    expect(graph.nodes.map((n) => [n.key, n.screen])).toEqual([
      ["pay", "cart"],
      ["back", "cart"],
      ["ok", "done"],
    ]);
  });

  it("reports what it cannot use, with the line", () => {
    const r = parseFlow(`flowchart TD
      a --> 
      b ~~~ c
      subgraph s
      a --> s
      classDef x fill:#f00`);
    const lines = r.issues.map((i) => i.line);
    expect(lines).toContain(2); // a link needs a target
    expect(lines).toContain(3); // unreadable link
    expect(lines).not.toContain(5); // a link to a subgraph is fine
    expect(lines).toContain(6); // ignored statement
    expect(r.issues.some((i) => /not closed/.test(i.message))).toBe(true);
  });

  it("round-trips through serialize", () => {
    const text = `flowchart LR
      subgraph s1["Screen 1"]
        a["Buy"]
        b{"OK?"}
      end
      c(("Done"))
      a -->|"click"| b
      b -.->|"no"| a
      b --> c
      c ==> a`;
    const first = parseFlow(text).graph;
    const again = parseFlow(serializeFlow(first));
    expect(again.issues).toEqual([]);
    expect(again.graph).toEqual(first);
  });

  it("makes safe unique keys", () => {
    const taken = new Set(["pay"]);
    expect(slugKey("Pay", taken)).toBe("pay_2");
    expect(slugKey("Été à Paris!", new Set())).toBe("ete_a_paris");
    expect(slugKey("1st", new Set())).toBe("n_1st");
    expect(slugKey("???", new Set())).toBe("step");
    expect(slugKey("end", new Set())).toBe("end_2");
  });
});
