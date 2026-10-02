/**
 * A PDF of the drawing, kept as vectors: the SVG export is laid out by the
 * browser engine, so shapes stay paths and text stays text for other editors.
 * The desktop app saves it itself; a browser opens the print dialog, where
 * "Save as PDF" does the same.
 */
export type PdfProvider = (args: {
  svg: string;
  width: number;
  height: number;
  name: string;
}) => Promise<unknown>;

let provider: PdfProvider | null = null;

export const setPdfExportProvider = (next: PdfProvider | null) => {
  provider = next;
};

const sizeOf = (svg: SVGSVGElement) => {
  const viewBox = svg.viewBox?.baseVal;
  const width =
    parseFloat(svg.getAttribute("width") ?? "") || viewBox?.width || 800;
  const height =
    parseFloat(svg.getAttribute("height") ?? "") || viewBox?.height || 600;
  return { width, height };
};

export const exportSvgToPdf = async (svg: SVGSVGElement, name: string) => {
  const { width, height } = sizeOf(svg);
  const markup = new XMLSerializer().serializeToString(svg);
  if (provider) {
    return provider({ svg: markup, width, height, name });
  }
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error("Allow pop-ups to print the drawing as a PDF");
  }
  win.document.write(
    `<!doctype html><title>${name.replace(
      /[<>&]/g,
      "",
    )}</title><style>@page{size:${width}px ${height}px;margin:0}html,body{margin:0}svg{display:block}</style>${markup}`,
  );
  win.document.close();
  win.focus();
  win.print();
};
