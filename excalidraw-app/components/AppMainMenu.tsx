import { eyeIcon } from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { AutosaveMenuItem } from "../autosave/AutosaveMenuItem";
import { useSetAtom } from "../app-jotai";
import { getWorkspaceBridge } from "../workspace/desktopBridge";
import {
  saveCopyDialogOpenAtom,
  workspaceDialogOpenAtom,
} from "../workspace/workspaceState";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  theme: Theme | "system";
  refresh: () => void;
}> = React.memo((props) => {
  const openWorkspaces = useSetAtom(workspaceDialogOpenAtom);
  const openSaveCopy = useSetAtom(saveCopyDialogOpenAtom);
  return (
    <MainMenu>
      {getWorkspaceBridge() && (
        <MainMenu.Item
          data-testid="workspaces-menu"
          onSelect={() => openWorkspaces(true)}
        >
          Workspaces…
        </MainMenu.Item>
      )}
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.ImportFiles />
      <MainMenu.DefaultItems.SaveToActiveFile />
      {getWorkspaceBridge() && (
        <MainMenu.Item
          data-testid="save-copy-menu"
          onSelect={() => openSaveCopy(true)}
        >
          Save a copy…
        </MainMenu.Item>
      )}
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences
        additionalItems={<AutosaveMenuItem />}
      />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
