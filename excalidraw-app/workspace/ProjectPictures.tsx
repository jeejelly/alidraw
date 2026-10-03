import { IconButton, ImageIcon } from "./ProjectIcons";

import type { ProjectAsset } from "./useProjectData";

/** Linked pictures of the workspace; clicking one puts it on the canvas. */
export const ProjectPictures = ({
  workspaceId,
  assets,
  thumbs,
  onInsert,
  onImport,
}: {
  workspaceId: string;
  assets: ProjectAsset[];
  thumbs: Record<string, string>;
  onInsert: (asset: ProjectAsset) => void;
  onImport: () => void;
}) => (
  <>
    <div className="project__head">
      <strong>Pictures</strong>
      <IconButton
        icon="image"
        title="Import SVG and images into the design"
        testId="project-import"
        onClick={onImport}
      />
    </div>
    <div className="project__assets" data-testid="project-assets">
      {assets.length === 0 && (
        <span className="workspace__hint">No linked pictures yet.</span>
      )}
      {assets.slice(0, 40).map((asset) => {
        const src = thumbs[`${workspaceId}:${asset.path}`];
        return (
          <button
            key={asset.path}
            type="button"
            className="project__asset"
            data-testid="project-asset"
            title={`${asset.path} — click to put it on the canvas`}
            onClick={() => onInsert(asset)}
          >
            {src ? <img src={src} alt="" /> : <ImageIcon />}
          </button>
        );
      })}
    </div>
  </>
);
