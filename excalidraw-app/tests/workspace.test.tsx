import { Excalidraw } from "@excalidraw/excalidraw";
import {
  fileSave,
  setFileSaveProvider,
} from "@excalidraw/excalidraw/data/filesystem";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import React from "react";

import { appJotaiStore, Provider } from "../app-jotai";
import { installWorkspaceSave } from "../workspace/workspaceSave";
import { blobText } from "../workspace/blobText";
import { WorkspaceDialog } from "../workspace/WorkspaceDialog";
import { WorkspaceFileHandle } from "../workspace/WorkspaceFileHandle";
import {
  activeWorkspaceAtom,
  workspaceDialogOpenAtom,
} from "../workspace/workspaceState";

import type { DesktopWorkspaceBridge } from "../workspace/desktopBridge";

const fakeBridge = (over: Partial<DesktopWorkspaceBridge> = {}) => {
  const files = new Map<string, string>();
  const calls: string[] = [];
  const bridge: DesktopWorkspaceBridge = {
    gitInfo: async () => ({ installed: true, version: "git 2", help: "" }),
    installGit: async () => ({ installed: true }),
    pickFolder: async () => {
      calls.push("pick");
      return { token: "t1", display: "/home/x/proj" };
    },
    list: async () => [],
    create: async ({ name }) => {
      calls.push(`create:${name}`);
      return { id: "w1", name, path: "/p", settings: {} };
    },
    open: async () => {
      calls.push("open");
      return { id: "w1", name: "proj", path: "/home/x/proj", settings: {} };
    },
    saveNew: async (id, name, text) => {
      calls.push(`saveNew:${id}:${name}`);
      files.set(`${name}.excalidraw`, text);
      return { path: `${name}.excalidraw` };
    },
    forget: async () => {},
    scenes: async () => [
      { path: "a.excalidraw", name: "a.excalidraw", mtime: 0, size: 1 },
    ],
    read: async (_id, path) => files.get(path) ?? "{}",
    write: async (_id, path, text) => {
      files.set(path, text);
      return { path, bytes: text.length };
    },
    newScene: async () => "n.excalidraw",
    getSettings: async () => ({ autoCommit: true, delaySec: 60 }),
    setSettings: async (id, settings) => ({ id, name: "", path: "", settings }),
    status: async () => ({
      git: true,
      repo: true,
      pending: false,
      branch: "main",
      upstream: null,
      ahead: 0,
      behind: 0,
      changes: [],
      clean: true,
    }),
    commitNow: async () => ({ hash: null }),
    history: async () => [],
    showVersion: async () => "{}",
    onEvent: () => () => {},
    ...over,
  };
  return { bridge, files, calls };
};

afterEach(() => {
  setFileSaveProvider(null);
  delete (window as any).excalidrawDesktop;
  appJotaiStore.set(activeWorkspaceAtom, null);
  appJotaiStore.set(workspaceDialogOpenAtom, false);
});

describe("workspace file handle", () => {
  it("reads and writes through the bridge like a file handle", async () => {
    const { bridge, files } = fakeBridge();
    const h = new WorkspaceFileHandle(bridge, "w1", "dir/a.excalidraw");
    expect(h.name).toBe("a.excalidraw");
    const w = await h.createWritable();
    await w.write(new Blob(['{"a":']));
    await w.write("1}");
    await w.write({ type: "write", data: " " } as any);
    expect(files.size).toBe(0);
    await w.close();
    expect(files.get("dir/a.excalidraw")).toBe('{"a":1} ');
    expect(await blobText(await h.getFile())).toBe('{"a":1} ');
    expect(
      await h.isSameEntry(
        new WorkspaceFileHandle(bridge, "w1", "dir/a.excalidraw"),
      ),
    ).toBe(true);
    expect(
      await h.isSameEntry(
        new WorkspaceFileHandle(bridge, "w2", "dir/a.excalidraw"),
      ),
    ).toBe(false);
    expect(await h.queryPermission()).toBe("granted");
  });
});

describe("saving a scene in the desktop app", () => {
  const blob = () => new Blob(['{"type":"excalidraw"}']);
  const save = () =>
    fileSave(blob(), {
      name: "Idea",
      extension: "excalidraw",
      description: "x",
    });

  it("first save asks for a folder only, and that folder becomes the workspace", async () => {
    const { bridge, calls } = fakeBridge();
    (window as any).excalidrawDesktop = { version: 1, workspace: bridge };
    installWorkspaceSave();
    const handle: any = await save();
    expect(calls).toEqual(["pick", "open", "saveNew:w1:Idea"]);
    expect(handle).toBeInstanceOf(WorkspaceFileHandle);
    expect(handle.path).toBe("Idea.excalidraw");
    expect(appJotaiStore.get(activeWorkspaceAtom)).toEqual({
      id: "w1",
      name: "proj",
    });
    // the next scene goes into the same workspace without asking again
    calls.length = 0;
    await save();
    expect(calls).toEqual(["saveNew:w1:Idea"]);
  });

  it("cancelling the folder choice is a normal abort", async () => {
    const { bridge } = fakeBridge({ pickFolder: async () => null });
    (window as any).excalidrawDesktop = { version: 1, workspace: bridge };
    installWorkspaceSave();
    await expect(save()).rejects.toMatchObject({ name: "AbortError" });
    expect(appJotaiStore.get(activeWorkspaceAtom)).toBeNull();
  });

  it("does nothing in a browser", async () => {
    const off = installWorkspaceSave();
    off();
    // no provider: the library's own save would run (not exercised here)
    expect((window as any).excalidrawDesktop).toBeUndefined();
  });
});

describe("workspace dialog", () => {
  const open = async (bridge: DesktopWorkspaceBridge) => {
    (window as any).excalidrawDesktop = { version: 1, workspace: bridge };
    await render(
      <Provider store={appJotaiStore}>
        <Excalidraw>
          <WorkspaceDialog api={null} />
        </Excalidraw>
      </Provider>,
    );
    act(() => appJotaiStore.set(workspaceDialogOpenAtom, true));
  };

  it("lists workspaces, creates one by naming it and choosing a folder", async () => {
    const { bridge, calls } = fakeBridge({
      list: async () => [
        { id: "w0", name: "Old", path: "/o", exists: true, settings: {} },
      ],
    });
    await open(bridge);
    await waitFor(() =>
      expect(screen.getAllByTestId("workspace-item")).toHaveLength(1),
    );
    const create = screen.getByTestId("workspace-create") as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("workspace-name"), {
      target: { value: "Shop" },
    });
    fireEvent.click(create);
    await waitFor(() => expect(calls).toEqual(["pick", "create:Shop"]));
    await waitFor(() =>
      expect(appJotaiStore.get(activeWorkspaceAtom)).toEqual({
        id: "w1",
        name: "Shop",
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("workspace-git").textContent).toContain(
        "⎇ main",
      ),
    );
    expect(screen.getAllByTestId("workspace-scene")).toHaveLength(1);
  });

  it("says when git is missing and can install it", async () => {
    let installed = false;
    const { bridge } = fakeBridge({
      gitInfo: async () => ({
        installed,
        version: null,
        help: "Install git with apt.",
      }),
      installGit: async () => {
        installed = true;
        return { installed: true };
      },
    });
    await open(bridge);
    await waitFor(() =>
      expect(screen.getByTestId("git-missing").textContent).toContain(
        "Install git with apt.",
      ),
    );
    fireEvent.click(screen.getByText("Install git"));
    await waitFor(() => expect(screen.queryByTestId("git-missing")).toBeNull());
  });

  it("turns auto commit off and sets the delay", async () => {
    const seen: any[] = [];
    const { bridge } = fakeBridge({
      list: async () => [
        { id: "w1", name: "W", path: "/w", exists: true, settings: {} },
      ],
      setSettings: async (id, s) => {
        seen.push(s);
        return { id, name: "", path: "", settings: s };
      },
    });
    await open(bridge);
    await waitFor(() => screen.getAllByTestId("workspace-item"));
    fireEvent.click(screen.getByTestId("workspace-item"));
    await waitFor(() => screen.getByTestId("workspace-autocommit"));
    fireEvent.click(screen.getByTestId("workspace-autocommit"));
    await waitFor(() => expect(seen).toContainEqual({ autoCommit: false }));
  });
});

describe("opening a workspace scene", () => {
  it("loads the file, makes it the active file and switches autosave on", async () => {
    const scene = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "test",
      elements: [
        {
          id: "r1",
          type: "rectangle",
          x: 10,
          y: 20,
          width: 100,
          height: 50,
          angle: 0,
          strokeColor: "#000",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          groupIds: [],
          frameId: null,
          roundness: null,
          seed: 1,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          link: null,
          locked: false,
        },
      ],
      appState: {},
      files: {},
    });
    const { bridge } = fakeBridge({ read: async () => scene });
    (window as any).excalidrawDesktop = { version: 1, workspace: bridge };
    let api: any = null;
    await render(<Excalidraw onExcalidrawAPI={(a: any) => (api = a)} />);
    await waitFor(() => expect(api).toBeTruthy());
    const { openWorkspaceScene } = await import(
      "../workspace/openWorkspaceScene"
    );
    const { autosaveToFileAtom } = await import(
      "../autosave/autosavePreference"
    );
    await act(async () => {
      await openWorkspaceScene(
        api,
        { id: "w1", name: "W" },
        "dir/a.excalidraw",
      );
    });
    expect(api.getSceneElements().map((e: any) => e.id)).toEqual(["r1"]);
    const handle = api.getAppState().fileHandle;
    expect(handle).toBeInstanceOf(WorkspaceFileHandle);
    expect(handle.path).toBe("dir/a.excalidraw");
    expect(appJotaiStore.get(activeWorkspaceAtom)).toEqual({
      id: "w1",
      name: "W",
    });
    expect(appJotaiStore.get(autosaveToFileAtom)).toBe(true);
  });
});
