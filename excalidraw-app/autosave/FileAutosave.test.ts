import { FileAutosave } from "./FileAutosave";

import type { AutosaveStatus } from "./autosaveStatus";
import type { JSONExportData } from "@excalidraw/excalidraw/data/json";

const DELAY = 20_000;

const handle = (name: string) => ({ name } as FileSystemFileHandle);

const scene = (
  fileHandle: FileSystemFileHandle | null,
  nonces: number[],
  appState: Record<string, unknown> = {},
) =>
  ({
    elements: nonces.map((versionNonce) => ({ versionNonce })),
    appState: { fileHandle, viewBackgroundColor: "#fff", ...appState },
    files: {},
  } as unknown as JSONExportData);

const setup = (
  write = vi.fn(async () => {}),
  isPermissionError = (_: unknown) => false,
) => {
  const statuses: AutosaveStatus[] = [];
  const autosave = new FileAutosave({
    write,
    isPermissionError,
    supported: true,
    delayMs: DELAY,
    report: (status) => statuses.push(status),
    now: () => new Date(2026, 8, 17, 10, 42),
  });
  return { autosave, write, statuses };
};

describe("FileAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes nothing when a file is opened", async () => {
    const { autosave, write } = setup();
    autosave.observe(true, scene(handle("a.excalidraw"), [1]));
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(write).not.toHaveBeenCalled();
  });

  it("writes the last scene once, 20 s after the last edit", async () => {
    const { autosave, write, statuses } = setup();
    const file = handle("a.excalidraw");
    autosave.observe(true, scene(file, [1]));
    autosave.observe(true, scene(file, [2]));
    await vi.advanceTimersByTimeAsync(DELAY - 1_000);
    const last = scene(file, [3]);
    autosave.observe(true, last);
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(last, file);
    expect(statuses.at(-1)).toMatchObject({
      kind: "saved",
      fileName: "a.excalidraw",
    });
  });

  it("does not write for a change that leaves the file content as it was", async () => {
    const { autosave, write } = setup();
    const file = handle("a.excalidraw");
    autosave.observe(true, scene(file, [1]));
    autosave.observe(true, scene(file, [1], { scrollX: 400, zoom: 2 }));
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(write).not.toHaveBeenCalled();
  });

  it("says a scene with no file is not saved to one, and writes nothing", async () => {
    const { autosave, write, statuses } = setup();
    autosave.observe(true, scene(null, [1]));
    autosave.observe(true, scene(null, [2]));
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(write).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toEqual({ kind: "noFile" });
  });

  it("reports a missing write permission as such", async () => {
    const { autosave, statuses } = setup(
      vi.fn(async () => {
        throw new Error("denied");
      }),
      () => true,
    );
    const file = handle("a.png");
    autosave.observe(true, scene(file, [1]));
    autosave.observe(true, scene(file, [2]));
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(statuses.at(-1)).toEqual({
      kind: "needsPermission",
      fileName: "a.png",
    });
  });

  it("reports a failed write with its reason", async () => {
    const { autosave, statuses } = setup(
      vi.fn(async () => {
        throw new Error("disk full");
      }),
    );
    const file = handle("a.excalidraw");
    autosave.observe(true, scene(file, [1]));
    autosave.observe(true, scene(file, [2]));
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(statuses.at(-1)).toEqual({
      kind: "failed",
      fileName: "a.excalidraw",
      reason: "disk full",
    });
  });

  it("turned off, drops a pending write", async () => {
    const { autosave, write, statuses } = setup();
    const file = handle("a.excalidraw");
    autosave.observe(true, scene(file, [1]));
    autosave.observe(true, scene(file, [2]));
    autosave.observe(false, scene(file, [2]));
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(write).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toEqual({ kind: "off" });
  });

  it("another file opened takes its scene as the new baseline", async () => {
    const { autosave, write } = setup();
    autosave.observe(true, scene(handle("a.excalidraw"), [1]));
    autosave.observe(true, scene(handle("a.excalidraw"), [2]));
    autosave.observe(true, scene(handle("b.excalidraw"), [7]));
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(write).not.toHaveBeenCalled();
  });
});
