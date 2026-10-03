const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const { BrowserWindow, dialog, session } = require("electron");

const { handle } = require("./handle");

const MAX_HTML_LENGTH = 200 * 1024 * 1024;

const safeFileName = (name) =>
  String(name ?? "drawing")
    .replace(/[^A-Za-z0-9._ -]+/g, "-")
    .slice(0, 80) || "drawing";

/** A hidden window of its own session: only local files, no network, no scripts. */
const createPrintWindow = () => {
  const printSession = session.fromPartition("pdf-export");
  printSession.webRequest.onBeforeRequest((details, callback) =>
    callback({
      cancel: !(
        details.url.startsWith("file:") || details.url.startsWith("data:")
      ),
    }),
  );
  return new BrowserWindow({
    show: false,
    width: 1200,
    height: 900,
    webPreferences: {
      session: printSession,
      sandbox: true,
      javascript: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
};

/** With a workspace the save dialog opens in its exports folder. */
const exportsFolder = (workspaces, workspaceId) => {
  if (typeof workspaceId !== "string") {
    return null;
  }
  try {
    const folder = path.join(workspaces.root(workspaceId), "exports");
    fs.mkdirSync(folder, { recursive: true });
    return folder;
  } catch {
    return null;
  }
};

const registerPdfHandlers = ({ workspaces }) => {
  // a vector PDF of the drawing: the browser engine lays the SVG out and embeds its fonts, so
  // shapes stay shapes and text stays text for other editors
  handle("pdf:export", async ({ html, name, workspaceId }, event) => {
    if (typeof html !== "string" || html.length > MAX_HTML_LENGTH) {
      throw new Error("nothing to export");
    }
    const fileName = safeFileName(name);
    const htmlFile = path.join(
      os.tmpdir(),
      `excalidraw-pdf-${randomUUID()}.html`,
    );
    fs.writeFileSync(htmlFile, html);
    const printWindow = createPrintWindow();
    try {
      await printWindow.loadFile(htmlFile);
      const pdf = await printWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
      });
      const folder = exportsFolder(workspaces, workspaceId);
      const picked = await dialog.showSaveDialog(
        BrowserWindow.fromWebContents(event.sender),
        {
          defaultPath: folder
            ? path.join(folder, `${fileName}.pdf`)
            : `${fileName}.pdf`,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        },
      );
      if (picked.canceled || !picked.filePath) {
        return { saved: false };
      }
      fs.writeFileSync(picked.filePath, pdf);
      return { saved: true };
    } finally {
      printWindow.destroy();
      fs.rmSync(htmlFile, { force: true });
    }
  });
};

module.exports = { registerPdfHandlers };
