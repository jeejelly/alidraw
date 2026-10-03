const { ipcMain } = require("electron");

const { ORIGIN } = require("../webbuild");

/** One handler: only the app's own page may ask, errors come back as values. */
const handle = (channel, handler) =>
  ipcMain.handle(channel, async (event, payload) => {
    if (!event.senderFrame || !event.senderFrame.url.startsWith(ORIGIN)) {
      return { ok: false, error: "refused" };
    }
    try {
      return { ok: true, value: await handler(payload ?? {}, event) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

module.exports = { handle };
