import { t } from "@excalidraw/excalidraw/i18n";

import { useAtomValue } from "../app-jotai";

import { autosaveStatusAtom } from "./autosaveStatus";

import type { AutosaveStatus as Status } from "./autosaveStatus";

const clock = (at: Date) =>
  at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const describe = (status: Status): string | null => {
  switch (status.kind) {
    case "off":
    case "idle":
      return null;
    case "unsupported":
      return t("autosave.unsupported");
    case "noFile":
      return t("autosave.noFile");
    case "needsPermission":
      return t("autosave.needsPermission", { filename: status.fileName });
    case "saving":
      return t("autosave.saving", { filename: status.fileName });
    case "saved":
      return t("autosave.saved", {
        filename: status.fileName,
        time: clock(status.at),
      });
    case "failed":
      return t("autosave.failed", {
        filename: status.fileName,
        reason: status.reason,
      });
  }
};

/** One line in the footer saying what autosave to file last did. */
export const AutosaveStatus = () => {
  const status = useAtomValue(autosaveStatusAtom);
  const text = describe(status);
  if (!text) {
    return null;
  }
  return (
    <div
      className="autosave-status"
      data-testid="autosave-status"
      data-kind={status.kind}
      style={{
        fontSize: ".75rem",
        color:
          status.kind === "failed" || status.kind === "needsPermission"
            ? "var(--color-danger)"
            : "var(--color-gray-60)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};
