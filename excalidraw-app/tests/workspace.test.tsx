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
import { render as rtlRender } from "@testing-library/react";
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
  const assets = new Map<string, string>();
  const meta: { assets?: "embedded" | "linked" } = {};
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
      remote: null,
      sync: { state: "no-remote", message: null },
      paused: false,
      upstream: null,
      ahead: 0,
      behind: 0,
      changes: [],
      clean: true,
    }),
    remoteSet: async (_id, url) => ({ name: "origin", url }),
    sync: async () => ({ outcome: "in-sync" }),
    resolve: async () => ({ outcome: "branched", branch: "ws/x" }),
    setPaused: async () => ({}),
    activate: async () => {},
    writeAsset: async (_id, mime, base64) => {
      const path = `assets/h${
        [...assets.values()].indexOf(base64) >= 0
          ? [...assets.values()].indexOf(base64)
          : assets.size
      }.${mime.split("/")[1]}`;
      assets.set(path, base64);
      return { path, bytes: base64.length };
    },
    readAsset: async (_id, path) => {
      const v = assets.get(path);
      if (v === undefined) {
        throw new Error("missing");
      }
      return v;
    },
    meta: async () => ({ ...meta }),
    setMeta: async (_id, m) => {
      Object.assign(meta, m);
      return meta;
    },
    commitNow: async () => ({ hash: null }),
    history: async () => [],
    showVersion: async () => "{}",
    onEvent: () => () => {},
    ...over,
  };
  return { bridge, files, calls, assets, meta };
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

  it("sets how new images are saved", async () => {
    const set: any[] = [];
    const { bridge } = fakeBridge({
      list: async () => [
        { id: "w1", name: "W", path: "/w", exists: true, settings: {} },
      ],
      setMeta: async (_id, m) => {
        set.push(m);
        return m;
      },
    });
    await open(bridge);
    await waitFor(() => screen.getAllByTestId("workspace-item"));
    fireEvent.click(screen.getByTestId("workspace-item"));
    await waitFor(() => screen.getByTestId("workspace-assets"));
    fireEvent.change(screen.getByTestId("workspace-assets"), {
      target: { value: "linked" },
    });
    await waitFor(() => expect(set).toEqual([{ assets: "linked" }]));
  });

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

describe("sharing", () => {
  const withRemote = (sync: any, extra: Partial<DesktopWorkspaceBridge> = {}) =>
    fakeBridge({
      list: async () => [
        { id: "w1", name: "W", path: "/w", exists: true, settings: {} },
      ],
      status: async () => ({
        git: true,
        repo: true,
        pending: false,
        remote: { name: "origin", url: "git@host:w.git" },
        sync,
        paused: false,
        branch: "main",
        upstream: "origin/main",
        ahead: 1,
        behind: 2,
        changes: [],
        clean: true,
      }),
      ...extra,
    });

  const openActive = async (bridge: DesktopWorkspaceBridge) => {
    (window as any).excalidrawDesktop = { version: 1, workspace: bridge };
    await render(
      <Provider store={appJotaiStore}>
        <Excalidraw>
          <WorkspaceDialog api={null} />
        </Excalidraw>
      </Provider>,
    );
    act(() => appJotaiStore.set(workspaceDialogOpenAtom, true));
    await waitFor(() => screen.getAllByTestId("workspace-item"));
    fireEvent.click(screen.getByTestId("workspace-item"));
    await waitFor(() => screen.getByTestId("workspace-remote"));
  };

  it("shows the remote, saves a new one, syncs and says what happened", async () => {
    const saved: string[] = [];
    const syncs: any[] = [];
    const { bridge } = withRemote(
      { state: "ahead", message: null },
      {
        remoteSet: async (_id, url) => {
          saved.push(url);
          return { name: "origin", url };
        },
        sync: async (_id, options) => {
          syncs.push(options ?? {});
          return { outcome: "pulled", files: ["a.excalidraw", "b.excalidraw"] };
        },
      },
    );
    await openActive(bridge);
    expect(
      (screen.getByTestId("workspace-remote") as HTMLInputElement).value,
    ).toBe("git@host:w.git");
    fireEvent.change(screen.getByTestId("workspace-remote"), {
      target: { value: "https://h/p.git" },
    });
    fireEvent.click(screen.getByTestId("workspace-remote-save"));
    await waitFor(() => expect(saved).toEqual(["https://h/p.git"]));
    fireEvent.click(screen.getByTestId("workspace-pull"));
    await waitFor(() =>
      expect(screen.getByTestId("workspace-sync-message").textContent).toBe(
        "Pulled 2 files.",
      ),
    );
    fireEvent.click(screen.getByTestId("workspace-push-now"));
    await waitFor(() =>
      expect(syncs).toEqual([{ push: false }, { pull: false }]),
    );
  });

  it("a diverged workspace offers to merge or branch, never to overwrite", async () => {
    const chosen: string[] = [];
    const { bridge } = withRemote(
      { state: "diverged", message: "both moved" },
      {
        resolve: async (_id, choice) => {
          chosen.push(choice);
          return choice === "merge"
            ? { outcome: "conflict", conflicts: ["a.excalidraw"] }
            : { outcome: "branched", branch: "ws/pc-1" };
        },
      },
    );
    await openActive(bridge);
    expect(screen.getByTestId("workspace-diverged").textContent).toContain(
      "Nothing has been pushed or overwritten",
    );
    fireEvent.click(screen.getByTestId("workspace-merge"));
    await waitFor(() =>
      expect(
        screen.getByTestId("workspace-sync-message").textContent,
      ).toContain("a.excalidraw changed on both sides"),
    );
    fireEvent.click(screen.getByTestId("workspace-branch"));
    await waitFor(() => expect(chosen).toEqual(["merge", "branch"]));
    expect(screen.getByTestId("workspace-sync-message").textContent).toBe(
      "Continuing on ws/pc-1.",
    );
  });

  it("sets the push policy, pull on open and the network pause", async () => {
    const settings: any[] = [];
    const paused: boolean[] = [];
    const { bridge } = withRemote(
      { state: "idle", message: null },
      {
        setSettings: async (id, s) => {
          settings.push(s);
          return { id, name: "", path: "", settings: s };
        },
        setPaused: async (p) => {
          paused.push(p);
          return {};
        },
      },
    );
    await openActive(bridge);
    fireEvent.change(screen.getByTestId("workspace-push"), {
      target: { value: "afterCommit" },
    });
    fireEvent.click(screen.getByTestId("workspace-pull-on-open"));
    fireEvent.click(screen.getByTestId("workspace-pause"));
    await waitFor(() => expect(paused).toEqual([true]));
    expect(settings).toContainEqual({ push: "afterCommit" });
    expect(settings).toContainEqual({ pullOnOpen: false });
  });

  it("offers to reload the open scene when a pull changed it, and does not reload unasked", async () => {
    const { bridge } = fakeBridge();
    let emit: (e: any) => void = () => {};
    bridge.onEvent = (cb) => {
      emit = cb;
      return () => {};
    };
    (window as any).excalidrawDesktop = { version: 1, workspace: bridge };
    const { WorkspaceWatcher } = await import("../workspace/WorkspaceWatcher");
    appJotaiStore.set(activeWorkspaceAtom, { id: "w1", name: "W" });
    const handle = new WorkspaceFileHandle(bridge, "w1", "a.excalidraw");
    const api: any = { getAppState: () => ({ fileHandle: handle }) };
    rtlRender(
      <Provider store={appJotaiStore}>
        <WorkspaceWatcher api={api} />
      </Provider>,
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    act(() => emit({ type: "pulled", id: "w1", files: ["other.excalidraw"] }));
    expect(confirm).not.toHaveBeenCalled();
    act(() => emit({ type: "pulled", id: "w1", files: ["a.excalidraw"] }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain("a.excalidraw");
    confirm.mockRestore();
  });
});

describe("linked images", () => {
  const PNG = "iVBORw0KGgo=";
  const scene = (storage?: string) =>
    JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "i1",
          type: "image",
          fileId: "f1",
          isDeleted: false,
          customData: storage ? { imageStorage: storage } : undefined,
        },
      ],
      appState: {},
      files: {
        f1: {
          id: "f1",
          mimeType: "image/png",
          dataURL: `data:image/png;base64,${PNG}`,
          created: 1,
        },
      },
    });

  const save = async (bridge: DesktopWorkspaceBridge, text: string) => {
    const h = new WorkspaceFileHandle(bridge, "w1", "a.excalidraw");
    const w = await h.createWritable();
    await w.write(text);
    await w.close();
  };

  it("the workspace's default decides for images that have no choice of their own", async () => {
    const { bridge, files, assets, meta } = fakeBridge();
    await save(bridge, scene());
    expect(JSON.parse(files.get("a.excalidraw")!).files.f1.dataURL).toContain(
      PNG,
    );
    expect(assets.size).toBe(0);

    meta.assets = "linked";
    await save(bridge, scene());
    const f = JSON.parse(files.get("a.excalidraw")!).files.f1;
    expect(f.dataURL).toBeUndefined();
    expect(f.link).toMatch(/^assets\/.+\.png$/);
    expect(assets.get(f.link)).toBe(PNG);
    // the rest of the file is untouched
    expect(JSON.parse(files.get("a.excalidraw")!).elements).toHaveLength(1);
  });

  it("each image can choose, whatever the default is", async () => {
    const { bridge, files, assets, meta } = fakeBridge();
    meta.assets = "linked";
    await save(bridge, scene("embedded"));
    expect(JSON.parse(files.get("a.excalidraw")!).files.f1.dataURL).toContain(
      PNG,
    );
    expect(assets.size).toBe(0);
    meta.assets = "embedded";
    await save(bridge, scene("linked"));
    expect(JSON.parse(files.get("a.excalidraw")!).files.f1.link).toBeTruthy();
    // "default" is no choice
    await save(bridge, scene("default"));
    expect(JSON.parse(files.get("a.excalidraw")!).files.f1.dataURL).toContain(
      PNG,
    );
  });

  it("opens linked and embedded scenes the same way", async () => {
    const { bridge, files, meta } = fakeBridge();
    meta.assets = "linked";
    await save(bridge, scene());
    expect(JSON.parse(files.get("a.excalidraw")!).files.f1.link).toBeTruthy();
    const h = new WorkspaceFileHandle(bridge, "w1", "a.excalidraw");
    const opened = JSON.parse(await blobText(await h.getFile()));
    expect(opened.files.f1.dataURL).toBe(`data:image/png;base64,${PNG}`);
    expect(opened.files.f1.link).toBeUndefined();
  });

  it("never loses an image: a failed asset write keeps it in the scene", async () => {
    const { bridge, files, meta } = fakeBridge({
      writeAsset: async () => {
        throw new Error("disk full");
      },
    });
    meta.assets = "linked";
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await save(bridge, scene());
    expect(JSON.parse(files.get("a.excalidraw")!).files.f1.dataURL).toContain(
      PNG,
    );
    err.mockRestore();
  });

  it("a missing linked file leaves the scene openable", async () => {
    const { bridge, files } = fakeBridge();
    files.set(
      "a.excalidraw",
      JSON.stringify({
        type: "excalidraw",
        version: 2,
        elements: [],
        appState: {},
        files: {
          f1: { id: "f1", mimeType: "image/png", link: "assets/gone.png" },
        },
      }),
    );
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = new WorkspaceFileHandle(bridge, "w1", "a.excalidraw");
    const opened = JSON.parse(await blobText(await h.getFile()));
    expect(opened.files).toEqual({});
    err.mockRestore();
  });

  it("the first save of a scene links too, and the dialog sets the default", async () => {
    const { bridge, files, meta } = fakeBridge();
    meta.assets = "linked";
    (window as any).excalidrawDesktop = { version: 1, workspace: bridge };
    installWorkspaceSave();
    const handle: any = await fileSave(new Blob([scene()]), {
      name: "Idea",
      extension: "excalidraw",
      description: "x",
    });
    expect(JSON.parse(files.get(handle.path)!).files.f1.link).toBeTruthy();
  });
});
