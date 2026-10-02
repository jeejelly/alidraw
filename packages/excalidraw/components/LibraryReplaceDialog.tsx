import { useEffect, useRef, useState } from "react";

import { exportToSvg } from "../scene/export";

import { Dialog } from "./Dialog";

import type { LibraryItem } from "../types";
import type App from "./App";

import "./LibraryReplaceDialog.scss";

const Preview = ({ item }: { item: LibraryItem }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    exportToSvg(
      item.elements.filter((e) => !e.isDeleted) as any,
      {
        exportBackground: false,
        viewBackgroundColor: "#ffffff",
        exportPadding: 4,
      },
      null,
      { skipInliningFonts: true },
    )
      .then((svg) => {
        if (cancelled || !ref.current) {
          return;
        }
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.style.maxWidth = "100%";
        svg.style.maxHeight = "100%";
        ref.current.replaceChildren(svg);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item]);
  return <div className="LibraryReplace__preview" ref={ref} />;
};

/** pick an item of the library to put where the selection is */
export const LibraryReplaceDialog = ({
  app,
  onClose,
}: {
  app: App;
  onClose: () => void;
}) => {
  const [items, setItems] = useState<readonly LibraryItem[] | null>(null);
  useEffect(() => {
    app.library
      .getLatestLibrary()
      .then(setItems)
      .catch(() => setItems([]));
  }, [app]);
  return (
    <Dialog
      onCloseRequest={onClose}
      title="Replace with a library item"
      size="wide"
    >
      <div className="LibraryReplace" data-testid="library-replace">
        {items === null ? (
          <p>Loading the library…</p>
        ) : items.length === 0 ? (
          <p data-testid="library-replace-empty">
            The library is empty. Select something, right-click and choose “Add
            to library” to put it there.
          </p>
        ) : (
          <div className="LibraryReplace__grid">
            {items.slice(0, 120).map((item) => (
              <button
                key={item.id}
                type="button"
                className="LibraryReplace__item"
                data-testid="library-replace-item"
                title={(item as any).name ?? "Library item"}
                onClick={() => {
                  app.replaceSelectionWithLibraryItem(item);
                  onClose();
                }}
              >
                <Preview item={item} />
              </button>
            ))}
          </div>
        )}
        <p className="LibraryReplace__hint">
          The item takes the place and size of what is selected. A component
          stretches like it does with Ctrl + drag; other shapes scale in
          proportion.
        </p>
      </div>
    </Dialog>
  );
};
