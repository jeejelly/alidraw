import React from "react";

import { applyFlow, parseFlow, serializeFlow } from "@excalidraw/flow";

import { Excalidraw } from "../index";

import { liveElements, resetTestState } from "./helpers/fixtures";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();

const handle = window.h;

beforeEach(resetTestState);

const ARCHITECTURE = `flowchart LR
    subgraph GAUCHE[" "]
        direction TB
        subgraph ANN["ANNUAIRE"]
            LDAP["🪪 <b>LDAP / AD</b><br/>source des identités"]
        end
        subgraph SSO["SSO"]
            KC["🔑 <b>Keycloak</b><br/>Authentification"]
        end
    end
    subgraph DROITE[" "]
        direction TB
        subgraph CLI["CLIENTS"]
            NAV["🌐 <b>Navigateur Web</b><br/>Chrome / Edge"]
        end
        subgraph WEB["SERVEUR WEB / APPLICATION"]
            FRONT["<b>Front HTTP</b> — répartition de charge"]
            subgraph TC["🐱 Apache Tomcat 9"]
                direction LR
                IHM["<b>IHM Web</b><br/>MDG · MDP"]
                WSI["<b>WSI — e-Services</b><br/>SOAP / REST"]
                MC["<b>msi-client</b><br/>appel des services métier"]
            end
            FRONT --> TC
        end
        subgraph MET["SERVEUR MÉTIER — AIX 7.3"]
            direction LR
            MSI["🖥️ <b>MSI</b><br/>Moniteur"]
            COB["<b>Services métier COBOL</b><br/>IBM COBOL"]
            MSI -->|ATMI| COB
        end
        subgraph DAT["DONNÉES"]
            ORA[("<b>ORACLE</b> Database")]
        end
        CLI ==>|"HTTPS · REST · WebSocket"| WEB
        WEB ==>|"appel de services (MSI)"| MET
        MET -->|"SQL*Net / local"| DAT
    end
    ANN -. LDAP .-> SSO
    SSO -. "authentification / habilitation" .-> WEB
    style GAUCHE fill:none,stroke:none
    style DROITE fill:none,stroke:none
`;

describe("subgraphs of a Mermaid flowchart", () => {
  it("reads labels without tags and keeps the links between subgraphs as written", () => {
    const { graph, issues } = parseFlow(ARCHITECTURE);
    expect(issues.filter((issue) => !issue.warn)).toEqual([]);
    expect(graph.nodes.find((node) => node.key === "LDAP")!.label).toBe(
      "🪪 LDAP / AD\nsource des identités",
    );
    const pairs = graph.edges.map((edge) => `${edge.from}>${edge.to}`);
    expect(pairs).toContain("CLI>WEB");
    expect(pairs).toContain("ANN>SSO");
    expect(serializeFlow(graph)).toContain("CLI ==>|");
  });

  it("draws them nested, apart, left to right, and leaves the untitled groups undrawn", async () => {
    await render(<Excalidraw />);
    const { graph } = parseFlow(ARCHITECTURE);
    act(() => {
      applyFlow(handle.app.scene, "arch", graph, { x: 0, y: 0 });
    });
    const live = liveElements();
    const frames = live.filter((element) => element.type === "frame") as any[];
    // the two untitled groups are not frames
    expect(frames.map((frame) => frame.name).sort()).toEqual(
      [
        "ANNUAIRE",
        "CLIENTS",
        "DONNÉES",
        "SERVEUR MÉTIER — AIX 7.3",
        "SERVEUR WEB / APPLICATION",
        "SSO",
        "🐱 Apache Tomcat 9",
      ].sort(),
    );
    const named = (name: string) => frames.find((frame) => frame.name === name);
    const inside = (inner: any, outer: any) =>
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height;
    // Tomcat sits inside the web server's frame
    expect(
      inside(named("🐱 Apache Tomcat 9"), named("SERVEUR WEB / APPLICATION")),
    ).toBe(true);
    // the frames that are not nested do not overlap
    const apart = [
      "ANNUAIRE",
      "SSO",
      "CLIENTS",
      "SERVEUR WEB / APPLICATION",
      "SERVEUR MÉTIER — AIX 7.3",
      "DONNÉES",
    ].map(named);
    for (const first of apart) {
      for (const second of apart) {
        if (first !== second) {
          const overlap =
            first.x < second.x + second.width &&
            second.x < first.x + first.width &&
            first.y < second.y + second.height &&
            second.y < first.y + first.height;
          expect(overlap).toBe(false);
        }
      }
    }
    // left to right: clients, web, business, data
    const left = (name: string) => named(name).x;
    expect(left("CLIENTS")).toBeLessThan(left("SERVEUR WEB / APPLICATION"));
    expect(left("SERVEUR WEB / APPLICATION")).toBeLessThan(
      left("SERVEUR MÉTIER — AIX 7.3"),
    );
    expect(left("SERVEUR MÉTIER — AIX 7.3")).toBeLessThan(left("DONNÉES"));
    // the links between subgraphs are drawn between their steps
    const bound = (
      live.filter((element) => element.type === "arrow") as any[]
    ).map(
      (arrow) =>
        `${
          live.find((el) => el.id === arrow.startBinding?.elementId)?.customData
            ?.flow?.key
        }>${
          live.find((el) => el.id === arrow.endBinding?.elementId)?.customData
            ?.flow?.key
        }`,
    );
    for (const pair of [
      "NAV>FRONT",
      "LDAP>KC",
      "KC>FRONT",
      "MC>MSI",
      "COB>ORA",
    ]) {
      expect(bound).toContain(pair);
    }
    // every link was drawn
    expect(live.filter((element) => element.type === "arrow").length).toBe(
      graph.edges.length,
    );
  });
});

describe("colours of a Mermaid flowchart", () => {
  it("gives new steps the fill, stroke and text colours of their classDef and style lines", async () => {
    await render(<Excalidraw />);
    const { graph } = parseFlow(
      [
        "flowchart LR",
        '  a["One"] --> b["Two"]',
        "  classDef box fill:#ffedd5,stroke:#fb923c,stroke-width:3px,color:#9a3412",
        "  class a box",
        "  style b fill:#0f0",
      ].join("\n"),
    );
    act(() => {
      applyFlow(handle.app.scene, "colours", graph, { x: 0, y: 0 });
    });
    const shapes = liveElements().filter(
      (element) => element.type === "rectangle",
    ) as any[];
    const text = (key: string) =>
      shapes.find((element) => element.customData?.flow?.key === key);
    expect(text("a")).toMatchObject({
      backgroundColor: "#ffedd5",
      strokeColor: "#fb923c",
      strokeWidth: 3,
    });
    expect(text("b").backgroundColor).toBe("#0f0");
    const label = liveElements().find(
      (element: any) =>
        element.type === "text" && element.containerId === text("a").id,
    ) as any;
    expect(label.strokeColor).toBe("#9a3412");
  });
});

describe("the look and layout of a drawn flow", () => {
  const SIMPLE = [
    "flowchart LR",
    "  %% @flow layout cascade",
    '  a["One"] --> b["Two"]',
    '  b --> c["Three"]',
  ].join("\n");

  it("draws filled boxes with thin rounded corners, clean text and plain arrows", async () => {
    await render(<Excalidraw />);
    const { graph } = parseFlow("flowchart TD\n  a[One] -->|go| b[Two]");
    act(() => {
      applyFlow(handle.app.scene, "look", graph, { x: 0, y: 0 });
    });
    const live = liveElements() as any[];
    const box = live.find((element) => element.type === "rectangle");
    expect(box).toMatchObject({
      roughness: 0,
      fillStyle: "solid",
      roundness: { value: 8 },
    });
    expect(box.backgroundColor).not.toBe("transparent");
    const label = live.find((element) => element.type === "text");
    expect(label.fontFamily).toBe(6);
    expect(live.find((element) => element.type === "arrow").roughness).toBe(0);
  });

  it("cascades: one column, each step lower and further right", async () => {
    await render(<Excalidraw />);
    const { graph } = parseFlow(SIMPLE);
    expect(graph.layout).toBe("cascade");
    act(() => {
      applyFlow(handle.app.scene, "stairs", graph, { x: 0, y: 0 });
    });
    const boxes = (liveElements() as any[])
      .filter((element) => element.type === "rectangle")
      .sort((first, second) => first.y - second.y);
    expect(boxes.length).toBe(3);
    expect(boxes[0].y + boxes[0].height).toBeLessThan(boxes[1].y);
    expect(boxes[1].y + boxes[1].height).toBeLessThan(boxes[2].y);
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[1].x).toBeLessThan(boxes[2].x);
  });

  it("keeps the layout line when the flow is written out again", () => {
    expect(serializeFlow(parseFlow(SIMPLE).graph)).toContain(
      "%% @flow layout cascade",
    );
  });

  it("puts each flow in a layer of its own", async () => {
    await render(<Excalidraw />);
    for (const name of ["Alpha", "Beta"]) {
      act(() => {
        applyFlow(
          handle.app.scene,
          name,
          parseFlow("flowchart TD\n  a[One] --> b[Two]").graph,
          { x: name === "Alpha" ? 0 : 600, y: 0 },
        );
        handle.app.layers.assignFlow(name);
      });
    }
    const { layers } = handle.state;
    const alpha = layers.find((layer) => layer.flow === "Alpha")!;
    const beta = layers.find((layer) => layer.flow === "Beta")!;
    expect(alpha.name).toBe("Alpha");
    expect(beta.id).not.toBe(alpha.id);
    const owner = (flow: string) =>
      new Set(
        (liveElements() as any[])
          .filter(
            (element) =>
              element.customData?.flow?.id === flow &&
              !(element.type === "text" && element.containerId),
          )
          .map((element) => element.customData.layerId),
      );
    expect(owner("Alpha")).toEqual(new Set([alpha.id]));
    expect(owner("Beta")).toEqual(new Set([beta.id]));
    // the stack order of the flow is kept: boxes under their links
    const kinds = (liveElements() as any[])
      .filter((element) => element.customData?.flow?.id === "Alpha")
      .map((element) => element.type);
    expect(kinds.indexOf("rectangle")).toBeLessThan(kinds.indexOf("arrow"));
    // redrawing the flow keeps the same layer
    act(() => {
      handle.app.layers.assignFlow("Alpha");
    });
    expect(
      handle.state.layers.filter((layer) => layer.flow === "Alpha"),
    ).toHaveLength(1);
  });
});
