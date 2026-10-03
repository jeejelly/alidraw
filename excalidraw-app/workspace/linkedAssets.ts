import type { DesktopWorkspaceBridge } from "./desktopBridge";

/**
 * Linked images: a scene that keeps an image's bytes as a file in the
 * workspace's `assets/` folder (named by content) and only refers to it:
 *
 *   embedded  files[id] = { mimeType, dataURL: "data:image/png;base64,…" }
 *   linked    files[id] = { mimeType, link: "assets/<hash>.png" }
 *
 * Each image chooses (`customData.imageStorage`), "default" follows the
 * workspace's `assets` setting. Both forms open the same way.
 */
export type AssetMode = "embedded" | "linked";

const DATA_URL = /^data:([^;,]+)(;[^,]*)?;base64,(.*)$/s;

type SceneJSON = {
  elements?: {
    type: string;
    isDeleted?: boolean;
    fileId?: string | null;
    customData?: { imageStorage?: string };
  }[];
  files?: Record<
    string,
    { mimeType?: string; dataURL?: string; link?: string }
  >;
};

const wants = (
  scene: SceneJSON,
  fileId: string,
  fallback: AssetMode,
): AssetMode => {
  let mode: AssetMode = "embedded";
  for (const el of scene.elements ?? []) {
    if (el.type !== "image" || el.isDeleted || el.fileId !== fileId) {
      continue;
    }
    const own = el.customData?.imageStorage;
    const storage = own === "embedded" || own === "linked" ? own : fallback;
    // one image that wants the bytes in the file keeps them there
    if (storage === "linked") {
      mode = "linked";
    } else {
      return "embedded";
    }
  }
  return mode;
};

/** the scene text, with the images that want to be linked moved out into assets */
export const externalizeAssets = async (
  bridge: DesktopWorkspaceBridge,
  workspaceId: string,
  text: string,
  fallback: AssetMode,
): Promise<string> => {
  let scene: SceneJSON;
  try {
    scene = JSON.parse(text);
  } catch {
    return text;
  }
  if (!scene.files || !Object.keys(scene.files).length) {
    return text;
  }
  let changed = false;
  for (const [id, file] of Object.entries(scene.files)) {
    if (!file.dataURL || wants(scene, id, fallback) !== "linked") {
      continue;
    }
    const match = DATA_URL.exec(file.dataURL);
    if (!match) {
      continue;
    }
    try {
      // content-addressed: the same bytes are never stored twice, and the file
      // is checked to exist on every save, so a link never dangles
      const { path } = await bridge.writeAsset(workspaceId, match[1], match[3]);
      delete file.dataURL;
      file.link = path;
      changed = true;
    } catch (error) {
      // never lose an image over a failed write: it stays inside the scene
      console.error("could not save a linked image", error);
    }
  }
  return changed ? JSON.stringify(scene, null, 2) : text;
};

/** the scene text with linked images read back in, so any code can open it */
export const hydrateAssets = async (
  bridge: DesktopWorkspaceBridge,
  workspaceId: string,
  text: string,
): Promise<string> => {
  let scene: SceneJSON;
  try {
    scene = JSON.parse(text);
  } catch {
    return text;
  }
  let changed = false;
  for (const [id, file] of Object.entries(scene.files ?? {})) {
    if (file.dataURL || !file.link) {
      continue;
    }
    try {
      const base64 = await bridge.readAsset(workspaceId, file.link);
      file.dataURL = `data:${
        file.mimeType ?? "application/octet-stream"
      };base64,${base64}`;
      delete file.link;
      changed = true;
    } catch (error) {
      // a missing file (not pulled or fetched yet) leaves a broken image, not a broken scene
      console.error(`linked image ${file.link} is missing`, error);
      delete scene.files![id];
      changed = true;
    }
  }
  return changed ? JSON.stringify(scene, null, 2) : text;
};
