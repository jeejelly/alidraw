import {
  DEFAULT_PDF_OPTIONS,
  pdfHtml,
  pdfLayout,
  sanitizePdfOptions,
} from "../data/pdfExport";

describe("pdf pages", () => {
  it("a page of the drawing's own size, plus the margin", () => {
    const layout = pdfLayout(800, 600, { ...DEFAULT_PDF_OPTIONS, margin: 10 });
    expect(layout.box).toBe("width:800px;height:600px");
    // 10 mm on each side is about 38 px
    expect(layout.pageCss).toBe("@page{size:876px 676px;margin:10mm}");
    expect(layout.scaled).toBe(false);
  });

  it("a drawing too big for a page is scaled down, never refused", () => {
    const layout = pdfLayout(40000, 20000, DEFAULT_PDF_OPTIONS);
    expect(layout.scaled).toBe(true);
    expect(layout.box).toBe("width:14000px;height:7000px");
  });

  it("fixed pages follow the drawing's shape or the chosen orientation", () => {
    const wide = pdfLayout(1000, 400, {
      ...DEFAULT_PDF_OPTIONS,
      page: "a4",
      margin: 10,
    });
    expect(wide.pageCss).toBe("@page{size:297mm 210mm;margin:10mm}");
    expect(wide.box).toBe("width:277mm;height:190mm");
    const forced = pdfLayout(1000, 400, {
      ...DEFAULT_PDF_OPTIONS,
      page: "a4",
      orientation: "portrait",
    });
    expect(forced.pageCss).toContain("210mm 297mm");
  });

  it("actual size keeps the drawing's pixels and counts the pages", () => {
    const layout = pdfLayout(700, 4000, {
      ...DEFAULT_PDF_OPTIONS,
      page: "a4",
      scale: "actual",
      margin: 10,
    });
    expect(layout.box).toBe("width:700px;height:4000px");
    expect(layout.pages).toBeGreaterThan(3);
  });

  it("settings are cleaned up, and the page puts the drawing in a box", () => {
    expect(
      sanitizePdfOptions({
        page: "x",
        margin: -5,
        scale: "fit",
        orientation: "up",
      }),
    ).toEqual(DEFAULT_PDF_OPTIONS);
    expect(sanitizePdfOptions({ page: "a3", margin: 500 }).margin).toBe(100);
    const { html } = pdfHtml(
      "<svg viewBox='0 0 10 10'></svg>",
      10,
      10,
      DEFAULT_PDF_OPTIONS,
      'a<b>"',
    );
    expect(html).toContain("<title>ab</title>");
    expect(html).toContain(
      ".pdf-box>svg{display:block;width:100%;height:100%}",
    );
  });
});
