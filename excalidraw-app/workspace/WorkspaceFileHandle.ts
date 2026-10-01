import { blobText } from "./blobText";
import {
  externalizeAssets,
  hydrateAssets,
  type AssetMode,
} from "./linkedAssets";

import type { DesktopWorkspaceBridge } from "./desktopBridge";

type WriteChunk =
  | string
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | { type: "write"; data: string | Blob | ArrayBuffer | ArrayBufferView };

/**
 * A scene file of a workspace, shaped like a FileSystemFileHandle so the
 * editor's own open, save and autosave code works on it unchanged. Reads and
 * writes go through the desktop app, which keeps them inside the workspace.
 */
export class WorkspaceFileHandle {
  readonly kind = "file" as const;

  constructor(
    private readonly bridge: DesktopWorkspaceBridge,
    readonly workspaceId: string,
    readonly path: string,
  ) {}

  get name() {
    return this.path.split("/").pop() ?? this.path;
  }

  async getFile() {
    const text = await hydrateAssets(
      this.bridge,
      this.workspaceId,
      await this.bridge.read(this.workspaceId, this.path),
    );
    return new File([text], this.name, { type: "application/json" });
  }

  async createWritable() {
    const parts: BlobPart[] = [];
    const bridge = this.bridge;
    const { workspaceId, path } = this;
    return {
      async write(chunk: WriteChunk) {
        const data =
          typeof chunk === "object" &&
          chunk !== null &&
          !(chunk instanceof Blob) &&
          "data" in chunk &&
          (chunk as { type?: string }).type === "write"
            ? (chunk as { data: BlobPart }).data
            : chunk;
        parts.push(data as BlobPart);
      },
      async truncate() {
        parts.length = 0;
      },
      async seek() {},
      async abort() {
        parts.length = 0;
      },
      async close() {
        // images that want to be linked files leave the scene text first
        let mode: AssetMode = "embedded";
        try {
          mode =
            (await bridge.meta(workspaceId)).assets === "linked"
              ? "linked"
              : "embedded";
        } catch {
          // an older desktop app: everything stays embedded
        }
        const text = await externalizeAssets(
          bridge,
          workspaceId,
          await blobText(new Blob(parts)),
          mode,
        );
        await bridge.write(workspaceId, path, text);
      },
    };
  }

  async isSameEntry(other: unknown) {
    return (
      other instanceof WorkspaceFileHandle &&
      other.workspaceId === this.workspaceId &&
      other.path === this.path
    );
  }

  async queryPermission() {
    return "granted" as const;
  }

  async requestPermission() {
    return "granted" as const;
  }
}

export const isWorkspaceHandle = (h: unknown): h is WorkspaceFileHandle =>
  h instanceof WorkspaceFileHandle;
