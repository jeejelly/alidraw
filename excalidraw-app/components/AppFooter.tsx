import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { AutosaveStatus } from "../autosave/AutosaveStatus";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          <AutosaveStatus />
        </div>
      </Footer>
    );
  },
);
