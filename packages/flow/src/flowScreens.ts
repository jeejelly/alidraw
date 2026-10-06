import type { FlowGraph, FlowScreen } from "./flowGraph";

/**
 * A subgraph with no title, or styled `stroke:none`, only groups steps for the layout
 * (Mermaid draws nothing for it): it is not drawn as a frame.
 */
export const isHiddenScreen = (graph: FlowGraph, screen: FlowScreen) =>
  !screen.label.trim() ||
  graph.trailer.some((line) =>
    new RegExp(`^style\\s+${screen.key}\\s+.*stroke:\\s*none`).test(line),
  );

/** the graph as it is drawn: hidden screens gone, their steps and screens taken up a level */
export const drawnGraph = (graph: FlowGraph): FlowGraph => {
  const hidden = new Set(
    graph.screens
      .filter((screen) => isHiddenScreen(graph, screen))
      .map((screen) => screen.key),
  );
  if (!hidden.size) {
    return graph;
  }
  const parentOf = new Map(
    graph.screens.map((screen) => [screen.key, screen.parent]),
  );
  const visible = (key: string | undefined): string | undefined => {
    let current = key;
    for (
      let guard = 0;
      current && hidden.has(current) && guard < 100;
      guard++
    ) {
      current = parentOf.get(current);
    }
    return current;
  };
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const { screen: _screen, ...rest } = node;
      const screen = visible(node.screen);
      return screen ? { ...rest, screen } : rest;
    }),
    screens: graph.screens
      .filter((screen) => !hidden.has(screen.key))
      .map((screen) => {
        const { parent: _parent, ...rest } = screen;
        const parent = visible(screen.parent);
        return parent ? { ...rest, parent } : rest;
      }),
  };
};
