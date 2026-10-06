import type { FlowEdge, FlowGraph } from "./flowGraph";

/**
 * A link to or from a subgraph drawn as a frame (`CLI ==> WEB`) is drawn between steps:
 * a frame cannot be linked. It leaves from the last step of the subgraph that nothing in
 * it follows, and arrives at the first step that nothing in it leads to. Subgraphs drawn
 * as flow elements (`linkable`) can be linked as they are.
 */
export const resolveScreenLinks = (
  graph: FlowGraph,
  linkable: ReadonlySet<string> = new Set(),
): FlowGraph => {
  const screens = new Map(graph.screens.map((screen) => [screen.key, screen]));
  if (
    !graph.edges.some((edge) => screens.has(edge.from) || screens.has(edge.to))
  ) {
    return graph;
  }
  const inside = (key: string) =>
    graph.nodes.filter((node) => {
      for (
        let screen = node.screen, guard = 0;
        screen && guard < 50;
        screen = screens.get(screen)?.parent, guard++
      ) {
        if (screen === key) {
          return true;
        }
      }
      return false;
    });
  const edges = graph.edges.map((edge): FlowEdge => {
    const resolved = { ...edge };
    for (const side of ["from", "to"] as const) {
      const key = edge[side];
      if (!screens.has(key) || linkable.has(key)) {
        continue;
      }
      const members = inside(key);
      const keys = new Set(members.map((member) => member.key));
      const open = members.filter(
        (member) =>
          !graph.edges.some((other) =>
            side === "from"
              ? other.from === member.key && keys.has(other.to)
              : other.to === member.key && keys.has(other.from),
          ),
      );
      const chosen =
        side === "from"
          ? open[open.length - 1] ?? members[members.length - 1]
          : open[0] ?? members[0];
      if (chosen) {
        resolved[side] = chosen.key;
      }
    }
    return resolved;
  });
  return { ...graph, edges };
};
