import type { BackupResult } from "./desktopBridge";

const plural = (count: number) => (count === 1 ? "" : "s");

export const describeBackup = (result: BackupResult): string => {
  switch (result.outcome) {
    case "done":
      return `Backed up ${result.uploaded} image${plural(result.uploaded)}, ${
        result.already
      } already there${
        result.failed.length ? `, ${result.failed.length} failed` : ""
      }.`;
    case "fetched":
      return `Fetched ${result.downloaded} image${plural(result.downloaded)}${
        result.failed.length ? `, ${result.failed.length} failed` : ""
      }.`;
    case "ok":
      return `Connected. ${result.files} image${plural(
        result.files,
      )} on the server.`;
    case "paused":
      return "Network is paused.";
    case "no-server":
      return "No server set.";
    case "locked":
      return "Unlock the passwords first.";
    case "no-password":
      return "Enter the server's password.";
    default:
      return result.message;
  }
};
