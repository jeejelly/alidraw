import DropdownMenuItemCheckbox from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItemCheckbox";
import { t } from "@excalidraw/excalidraw/i18n";

import { useAtom } from "../app-jotai";

import { autosaveToFileAtom } from "./autosavePreference";

export const AutosaveMenuItem = () => {
  const [enabled, setEnabled] = useAtom(autosaveToFileAtom);
  return (
    <DropdownMenuItemCheckbox
      checked={enabled}
      data-testid="autosave-to-file-toggle"
      onSelect={(event) => {
        setEnabled(!enabled);
        event.preventDefault();
      }}
    >
      {t("autosave.toggle")}
    </DropdownMenuItemCheckbox>
  );
};
