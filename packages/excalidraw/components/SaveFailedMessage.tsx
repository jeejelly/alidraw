import { actionSaveFileToDisk } from "../actions/actionExport";
import { t } from "../i18n";

import { useExcalidrawActionManager, useExcalidrawSetAppState } from "./App";
import { FilledButton } from "./FilledButton";

/** A Save that could not write its file: the reason, and Save as, which opens its dialog only when pressed. */
export const SaveFailedMessage = ({
  fileName,
  reason,
}: {
  fileName: string;
  reason: string;
}) => {
  const actionManager = useExcalidrawActionManager();
  const setAppState = useExcalidrawSetAppState();
  return (
    <>
      <p>{t("errors.saveToFileFailed", { filename: fileName, reason })}</p>
      <FilledButton
        label={t("buttons.saveAs")}
        onClick={() => {
          setAppState({ errorMessage: null });
          actionManager.executeAction(actionSaveFileToDisk, "ui");
        }}
      />
    </>
  );
};
