/**
 * A PDF of the drawing, kept as vectors: the SVG export is laid out by the
 * browser engine, so shapes stay paths and text stays text for other editors.
 * The desktop app saves it itself; a browser opens the print dialog, where
 * "Save as PDF" does the same.
 */
export type PdfPage = "content" | "a5" | "a4" | "a3" | "letter" | "legal";

export type PdfOptions = {
  /** `content`: a page exactly the size of the drawing (plus the margin) */
  page: PdfPage;
  orientation: "auto" | "portrait" | "landscape";
  /** mm, on every side */
  margin: number;
  /** `fit` scales the drawing to the page; `actual` keeps its size (1 px = 1/96 in) and may use several pages */
  scale: "fit" | "actual";
};

export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  page: "content",
  orientation: "auto",
  margin: 0,
  scale: "fit",
};

export const PDF_PAGES: Record<
  Exclude<PdfPage, "content">,
  [number, number]
> = {
  a5: [148, 210],
  a4: [210, 297],
  a3: [297, 420],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
};

const KEY = "excalidraw-pdf-options";

export const sanitizePdfOptions = (raw: unknown): PdfOptions => {
  const r = (raw ?? {}) as Partial<PdfOptions>;
  return {
    page:
      r.page === "content" || (r.page && r.page in PDF_PAGES)
        ? r.page
        : DEFAULT_PDF_OPTIONS.page,
    orientation:
      r.orientation === "portrait" || r.orientation === "landscape"
        ? r.orientation
        : "auto",
    margin: Number.isFinite(r.margin)
      ? Math.max(0, Math.min(100, Number(r.margin)))
      : 0,
    scale: r.scale === "actual" ? "actual" : "fit",
  };
};

export const getPdfOptions = (): PdfOptions => {
  try {
    return sanitizePdfOptions(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return DEFAULT_PDF_OPTIONS;
  }
};

export const setPdfOptions = (options: PdfOptions) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizePdfOptions(options)));
  } catch {
    // kept for this session only
  }
};

const MM = 96 / 25.4;
/** Chromium's page limit is 200 in; stay under it */
const MAX_PX = 14000;

/** the page's CSS and the box the drawing fills, from the drawing's size */
export const pdfLayout = (
  width: number,
  height: number,
  options: PdfOptions,
) => {
  const margin = options.margin;
  if (options.page === "content") {
    const k = Math.min(
      1,
      MAX_PX / (width + 2 * margin * MM),
      MAX_PX / (height + 2 * margin * MM),
    );
    const w = Math.round(width * k);
    const h = Math.round(height * k);
    return {
      pageCss: `@page{size:${w + Math.round(2 * margin * MM)}px ${
        h + Math.round(2 * margin * MM)
      }px;margin:${margin}mm}`,
      box: `width:${w}px;height:${h}px`,
      scaled: k < 1,
      pages: 1,
    };
  }
  let [pw, ph] = PDF_PAGES[options.page];
  const landscape =
    options.orientation === "landscape" ||
    (options.orientation === "auto" && width > height);
  if (landscape) {
    [pw, ph] = [ph, pw];
  }
  const cw = Math.max(10, pw - 2 * margin);
  const ch = Math.max(10, ph - 2 * margin);
  const fit = options.scale === "fit";
  return {
    pageCss: `@page{size:${pw}mm ${ph}mm;margin:${margin}mm}`,
    box: fit
      ? `width:${cw}mm;height:${ch}mm`
      : `width:${Math.round(width)}px;height:${Math.round(height)}px`,
    scaled: false,
    pages: fit ? 1 : Math.max(1, Math.ceil(height / (ch * MM))),
  };
};

/** the page, ready to print: the drawing in a box, scaled by its own viewBox */
export const pdfHtml = (
  svgMarkup: string,
  width: number,
  height: number,
  options: PdfOptions,
  title: string,
) => {
  const layout = pdfLayout(width, height, options);
  return {
    ...layout,
    html: `<!doctype html><meta charset="utf-8"><title>${title.replace(
      /[<>&"]/g,
      "",
    )}</title><style>${layout.pageCss}html,body{margin:0;padding:0}.pdf-box{${
      layout.box
    };overflow:hidden}.pdf-box>svg{display:block;width:100%;height:100%}</style><div class="pdf-box">${svgMarkup}</div>`,
  };
};

export type PdfProvider = (args: {
  html: string;
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

export const exportSvgToPdf = async (
  svg: SVGSVGElement,
  name: string,
  options: PdfOptions = getPdfOptions(),
) => {
  const { width, height } = sizeOf(svg);
  const copy = svg.cloneNode(true) as SVGSVGElement;
  // the box scales the drawing through its viewBox
  if (!copy.getAttribute("viewBox")) {
    copy.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  copy.removeAttribute("width");
  copy.removeAttribute("height");
  const { html } = pdfHtml(
    new XMLSerializer().serializeToString(copy),
    width,
    height,
    options,
    name,
  );
  if (provider) {
    return provider({ html, name });
  }
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error("Allow pop-ups to print the drawing as a PDF");
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
};
