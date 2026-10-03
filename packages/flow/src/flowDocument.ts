import { parseFlow } from "./flowParse";
import { serializeFlow } from "./flowSerialize";

import type { FlowGraph } from "./flowGraph";

/** one flow of a document: its name and its Mermaid text */
export type FlowSource = { name: string; text: string };

const FENCE = /^(`{3,}|~{3,})\s*mermaid\b.*$/i;
const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const FLOWCHART = /^\s*(?:%%.*\n\s*)*(flowchart|graph)\b/i;

/**
 * The flowcharts of a Markdown file: each ```mermaid block, named after the
 * heading above it. Other kinds of Mermaid diagram are not flows and are skipped.
 */
export const flowsFromMarkdown = (markdown: string): FlowSource[] => {
  const found: FlowSource[] = [];
  let heading = "";
  let fence: { mark: string; lines: string[]; name: string } | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    if (fence) {
      if (line.trim().startsWith(fence.mark)) {
        const text = fence.lines.join("\n");
        if (FLOWCHART.test(text)) {
          found.push({ name: fence.name, text: `${text}\n` });
        }
        fence = null;
      } else {
        fence.lines.push(line);
      }
      continue;
    }
    const opening = FENCE.exec(line.trim());
    if (opening) {
      fence = { mark: opening[1], lines: [], name: heading };
      continue;
    }
    const title = HEADING.exec(line);
    if (title) {
      heading = title[1];
    }
  }
  return found.map((flow, index) => ({
    ...flow,
    name: flow.name || `Flow ${index + 1}`,
  }));
};

/** What a file holds: Markdown with Mermaid blocks, or Mermaid text itself. */
export const flowsFromDocument = (
  text: string,
  fileName: string,
): FlowSource[] => {
  if (/\.(md|markdown)$/i.test(fileName)) {
    return flowsFromMarkdown(text);
  }
  const name = fileName.replace(/\.[^.]+$/, "") || "Flow 1";
  return FLOWCHART.test(text) ? [{ name, text }] : [];
};

/** Markdown with one section per flow, each a ```mermaid block that also says where its steps sit. */
export const flowsToMarkdown = (
  flows: readonly { name: string; graph: FlowGraph }[],
) =>
  flows
    .map(
      ({ name, graph }) =>
        `## ${name}\n\n\`\`\`mermaid\n${serializeFlow(graph, {
          layout: true,
        })}\`\`\`\n`,
    )
    .join("\n");

/** Mermaid text with the layout comments: a file that Mermaid renders and this app restores. */
export const flowToMermaidFile = (graph: FlowGraph) =>
  serializeFlow(graph, { layout: true });

/** Parses each source; the flows that cannot be read come back with their issues. */
export const parseSources = (sources: readonly FlowSource[]) =>
  sources.map((source) => ({ ...source, ...parseFlow(source.text) }));
