import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../../../i18n";
import { getHostCapabilities } from "../../../data/filesystem";
import { Section } from "../primitives";

import type App from "../../App";

type ImageStorage = "default" | "embedded" | "linked";

/**
 * Whether an image's bytes live inside the scene file or in a linked file
 * beside it (hosts that support linked images). "Default" follows the workspace.
 */
export const ImageStorageSection = ({ app }: { app: App }) => {
  if (!getHostCapabilities().linkedImages) {
    return null;
  }
  const images = app.scene
    .getSelectedElements(app.state)
    .filter((element) => element.type === "image");
  if (!images.length) {
    return null;
  }
  const storageOf = (element: ExcalidrawElement) =>
    (element.customData?.imageStorage as string | undefined) ?? "default";
  const storages = new Set(images.map(storageOf));
  const current = storages.size === 1 ? [...storages][0] : null;
  const setStorage = (value: ImageStorage) => {
    for (const element of images) {
      app.scene.mutateElement(element, {
        customData: { ...element.customData, imageStorage: value },
      });
    }
    app.store.scheduleCapture();
    app.setState({});
  };
  return (
    <Section
      title={t("labels.imageStorage.title")}
      testId="inspector-image-storage"
    >
      <div className="inspector__row" style={{ gap: 2 }}>
        {(
          [
            ["default", t("labels.imageStorage.default")],
            ["embedded", t("labels.imageStorage.embedded")],
            ["linked", t("labels.imageStorage.linked")],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="inspector__text"
            style={{ cursor: "pointer" }}
            data-testid={`image-storage-${value}`}
            aria-pressed={current === value}
            title={t(`labels.imageStorage.${value}Hint` as any)}
            onClick={() => setStorage(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </Section>
  );
};
