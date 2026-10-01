import { CaptureUpdateAction } from "@excalidraw/element";

import { copyTextToSystemClipboard } from "../clipboard";
import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";
import { elementsToMermaid } from "../mermaidExport";

import { register } from "./register";

/** the selection (or the whole diagram) as a Mermaid flowchart, on the clipboard */
export const actionCopyAsMermaid = register({
  name: "copyAsMermaid" as any,
  label: "labels.mermaid.copy" as any,
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["mermaid", "export", "flowchart", "text", "copy"],
  trackEvent: { category: "element" },
  perform: async (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    const { text, nodes, links } = elementsToMermaid(
      selected.length ? selected : elements,
    );
    if (!text) {
      return {
        appState: {
          ...appState,
          toast: { message: "No labelled shapes to export", closable: true },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
    try {
      await copyTextToSystemClipboard(text);
    } catch {
      return {
        appState: {
          ...appState,
          toast: { message: "Could not copy to the clipboard", closable: true },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
    return {
      appState: {
        ...appState,
        toast: {
          message: `Copied as Mermaid: ${nodes} nodes, ${links} links`,
          closable: true,
        },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
