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
  for (const scene of scenes) {
    const parts = scene.path.split("/");
    let node = root;
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      let next = node.children.find((child) => child.path === path);
      if (!next) {
        next = { name: part, path, children: [] };
        node.children.push(next);
      }
      if (index === parts.length - 1) {
        next.scene = scene;
      }
      node = next;
    });
  }
  const sort = (node: SceneNode) => {
    node.children.sort(
      (first, second) =>
        Number(!!first.scene) - Number(!!second.scene) ||
        first.name.localeCompare(second.name),
    );
    node.children.forEach(sort);
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
    nodes.map((node) =>
      node.scene ? (
        <li key={node.path}>
          {leaf(node.scene, depth, node.name.replace(/\.excalidraw$/, ""))}
        </li>
      ) : (
        <li key={node.path}>
          <button
            type="button"
            className="workspace__leaf"
            style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
            aria-expanded={!closed[node.path]}
            onClick={() => onToggle(node.path)}
          >
            <span className="workspace__chev">
              {closed[node.path] ? "▸" : "▾"}
            </span>
            {node.name}
          </button>
          {!closed[node.path] && <ul>{render(node.children, depth + 1)}</ul>}
        </li>
      ),
    );
  return <>{render(tree, 1)}</>;
};
