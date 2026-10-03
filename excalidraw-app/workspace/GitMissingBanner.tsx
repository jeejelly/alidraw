export const GitMissingBanner = ({
  help,
  onInstall,
}: {
  help: string;
  onInstall: () => void;
}) => (
  <div className="workspace__banner" data-testid="git-missing">
    git is not installed, so workspaces cannot be versioned yet. {help}
    <button type="button" onClick={onInstall}>
      Install git
    </button>
  </div>
);
