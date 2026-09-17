import { getDefaultAppState } from "../appState";

import {
  WritePermissionNeededError,
  writeSceneToHandle,
} from "./writeSceneToHandle";

import type { JSONExportData } from "./json";

const scene = {
  elements: [],
  appState: getDefaultAppState(),
  files: {},
} as unknown as JSONExportData;

const fakeHandle = (
  name: string,
  permission: PermissionState,
  onRequest: PermissionState = permission,
) => {
  const written: Blob[] = [];
  const handle = {
    name,
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => onRequest),
    createWritable: vi.fn(async () => ({
      write: async (blob: Blob) => {
        written.push(blob);
      },
      close: async () => {},
    })),
  };
  return { handle: handle as unknown as FileSystemFileHandle, raw: handle, written };
};

describe("writeSceneToHandle", () => {
  it("writes an .excalidraw file straight into a granted handle", async () => {
    const { handle, raw, written } = fakeHandle("a.excalidraw", "granted");
    await writeSceneToHandle(scene, handle);
    expect(raw.requestPermission).not.toHaveBeenCalled();
    expect(written).toHaveLength(1);
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(written[0]);
    });
    expect(JSON.parse(text).type).toBe("excalidraw");
  });

  it("without askPermission, refuses an ungranted handle and asks nothing", async () => {
    const { handle, raw } = fakeHandle("a.excalidraw", "prompt");
    await expect(writeSceneToHandle(scene, handle)).rejects.toBeInstanceOf(
      WritePermissionNeededError,
    );
    expect(raw.requestPermission).not.toHaveBeenCalled();
    expect(raw.createWritable).not.toHaveBeenCalled();
  });

  it("with askPermission, asks once and writes when granted", async () => {
    const { handle, raw, written } = fakeHandle(
      "a.excalidraw",
      "prompt",
      "granted",
    );
    await writeSceneToHandle(scene, handle, { askPermission: true });
    expect(raw.requestPermission).toHaveBeenCalledTimes(1);
    expect(written).toHaveLength(1);
  });

  it("with askPermission, refuses when the person denies", async () => {
    const { handle, raw } = fakeHandle("a.excalidraw", "prompt", "denied");
    await expect(
      writeSceneToHandle(scene, handle, { askPermission: true }),
    ).rejects.toBeInstanceOf(WritePermissionNeededError);
    expect(raw.createWritable).not.toHaveBeenCalled();
  });

  it("never opens a save dialog", async () => {
    const picker = vi.fn();
    (window as any).showSaveFilePicker = picker;
    const { handle } = fakeHandle("a.excalidraw", "denied");
    await expect(
      writeSceneToHandle(scene, handle, { askPermission: true }),
    ).rejects.toThrow();
    expect(picker).not.toHaveBeenCalled();
    delete (window as any).showSaveFilePicker;
  });
});
