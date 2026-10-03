import { applyFlow } from "./flowApply";
import {
  flowsToMarkdown,
  flowToMermaidFile,
  parseSources,
  type FlowSource,
} from "./flowDocument";
import { listFlows } from "./flowMeta";
import { readFlow } from "./flowRead";

import type { Scene } from "@excalidraw/element";

import type { FlowIssue } from "./flowGraph";

export type ImportReport = {
  /** the ids of the flows that were drawn */
  imported: string[];
  /** what could not be read or drawn, by flow name */
  problems: { name: string; issues: FlowIssue[] }[];
};

const uniqueId = (name: string, taken: ReadonlySet<string>) => {
  let id = name;
  for (let number = 2; taken.has(id); number++) {
    id = `${name} ${number}`;
  }
  return id;
};

/** Draws each flow of a document as a new flow of the scene. */
export const importFlows = (
  scene: Scene,
  sources: readonly FlowSource[],
  origin: { x: number; y: number },
): ImportReport => {
  const taken = new Set(listFlows(scene.getElementsIncludingDeleted()));
  const report: ImportReport = { imported: [], problems: [] };
  let offset = 0;
  for (const source of parseSources(sources)) {
    const blocking = source.issues.filter((issue) => !issue.warn);
    if (blocking.length) {
      report.problems.push({ name: source.name, issues: blocking });
      continue;
    }
    const id = uniqueId(source.name, taken);
    taken.add(id);
    const drawn = applyFlow(scene, id, source.graph, {
      x: origin.x,
      y: origin.y + offset,
    });
    report.imported.push(id);
    report.problems.push(
      ...(drawn.length ? [{ name: id, issues: drawn }] : []),
    );
    // flows without positions are stacked below the one before
    offset += 400;
  }
  return report;
};

/** The Markdown text of the given flows of the scene. */
export const exportFlows = (scene: Scene, flowIds: readonly string[]) => {
  const elements = scene.getElementsIncludingDeleted();
  return flowsToMarkdown(
    flowIds.map((name) => ({
      name,
      graph: readFlow(elements, name, { layout: true }),
    })),
  );
};

/** The Mermaid file text of one flow, with its layout comments. */
export const exportFlowAsMermaid = (scene: Scene, flowId: string) =>
  flowToMermaidFile(
    readFlow(scene.getElementsIncludingDeleted(), flowId, { layout: true }),
  );
