import { hashElementsVersion } from "@excalidraw/element";

import type { JSONExportData } from "@excalidraw/excalidraw/data/json";

import type { AutosaveStatus } from "./autosaveStatus";

export type FileAutosaveDeps = {
  /** Writes the scene into the handle's file; throws when it cannot. */
  write: (scene: JSONExportData, handle: FileSystemFileHandle) => Promise<void>;
  isPermissionError: (error: unknown) => boolean;
  /** Whether this browser can hold a writable file handle at all. */
  supported: boolean;
  delayMs: number;
  report: (status: AutosaveStatus) => void;
  now?: () => Date;
};

/** What a write would change in the file: element versions, background, embedded files. */
const contentKey = ({ elements, appState, files }: JSONExportData) =>
  `${hashElementsVersion(elements)}:${appState.viewBackgroundColor}:${
    Object.keys(files).length
  }`;

/**
 * Writes the scene back to the file it was opened from or saved to, once edits have
 * paused for `delayMs`.
 *
 * A scene is only written when it differs from what the file last held: opening a file,
 * or turning autosave on, takes the current scene as the baseline and writes nothing.
 */
export class FileAutosave {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private baseline: { handle: FileSystemFileHandle; key: string } | null =
    null;
  private pending: JSONExportData | null = null;

  constructor(private readonly deps: FileAutosaveDeps) {}

  observe(enabled: boolean, scene: JSONExportData) {
    if (!enabled) {
      this.reset();
      this.deps.report({ kind: "off" });
      return;
    }
    if (!this.deps.supported) {
      this.deps.report({ kind: "unsupported" });
      return;
    }
    const handle = scene.appState.fileHandle;
    if (!handle) {
      this.reset();
      this.deps.report({ kind: "noFile" });
      return;
    }
    const key = contentKey(scene);
    if (this.baseline?.handle !== handle) {
      this.reset();
      this.baseline = { handle, key };
      this.deps.report({ kind: "idle" });
      return;
    }
    if (this.baseline.key === key) {
      return;
    }
    this.baseline.key = key;
    this.pending = scene;
    this.cancelTimer();
    this.timer = setTimeout(() => this.flush(), this.deps.delayMs);
  }

  dispose() {
    this.reset();
  }

  private async flush() {
    this.timer = null;
    const scene = this.pending;
    const handle = scene?.appState.fileHandle;
    this.pending = null;
    if (!scene || !handle) {
      return;
    }
    const fileName = handle.name;
    this.deps.report({ kind: "saving", fileName });
    try {
      await this.deps.write(scene, handle);
      this.deps.report({
        kind: "saved",
        fileName,
        at: (this.deps.now ?? (() => new Date()))(),
      });
    } catch (error: unknown) {
      this.deps.report(
        this.deps.isPermissionError(error)
          ? { kind: "needsPermission", fileName }
          : {
              kind: "failed",
              fileName,
              reason: error instanceof Error ? error.message : String(error),
            },
      );
    }
  }

  private reset() {
    this.cancelTimer();
    this.baseline = null;
    this.pending = null;
  }

  private cancelTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
