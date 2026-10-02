import { useMemo } from "react";

import type { SceneEntry } from "./desktopBridge";

export type SceneNode = {
  name: string;
  path: string;
  scene?: SceneEntry;
  children: SceneNode[];
};

/** scenes grouped by folder, like a project browser */
export const sceneTree = (scenes: SceneEntry[]): SceneNode[] => {
  const root: SceneNode = { name: "", path: "", children: [] };
  for (const s of scenes) {
    const parts = s.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let next = node.children.find((c) => c.path === path);
      if (!next) {
        next = { name: part, path, children: [] };
        node.children.push(next);
      }
      if (i === parts.length - 1) {
        next.scene = s;
      }
      node = next;
    });
  }
  const sort = (n: SceneNode) => {
    n.children.sort(
      (a, b) =>
        Number(!!a.scene) - Number(!!b.scene) || a.name.localeCompare(b.name),
    );
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
};

/** the scenes of a workspace as folders and files, like a project browser */
export const SceneTreeView = ({
  scenes,
  closed,
  onToggle,
  leaf,
}: {
  scenes: SceneEntry[];
  closed: Record<string, boolean>;
  onToggle: (path: string) => void;
  /** one scene: its entry, how deep it sits, and its name without the extension */
  leaf: (scene: SceneEntry, depth: number, name: string) => React.ReactNode;
}) => {
  const tree = useMemo(() => sceneTree(scenes), [scenes]);
  const render = (nodes: SceneNode[], depth: number): React.ReactNode =>
    nodes.map((n) =>
      n.scene ? (
        <li key={n.path}>
          {leaf(n.scene, depth, n.name.replace(/\.excalidraw$/, ""))}
        </li>
      ) : (
        <li key={n.path}>
          <button
            type="button"
            className="workspace__leaf"
            style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
            aria-expanded={!closed[n.path]}
            onClick={() => onToggle(n.path)}
          >
            <span className="workspace__chev">
              {closed[n.path] ? "▸" : "▾"}
            </span>
            {n.name}
          </button>
          {!closed[n.path] && <ul>{render(n.children, depth + 1)}</ul>}
        </li>
      ),
    );
  return <>{render(tree, 1)}</>;
};
