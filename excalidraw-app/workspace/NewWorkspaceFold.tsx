import { Fold } from "./Fold";

export const NewWorkspaceFold = ({
  name,
  expandedByDefault,
  onNameChange,
  onCreate,
}: {
  name: string;
  expandedByDefault: boolean;
  onNameChange: (name: string) => void;
  onCreate: () => void;
}) => (
  <Fold id="new" title="New workspace" defaultOpen={expandedByDefault}>
    <div className="workspace__new">
      <input
        data-testid="workspace-name"
        placeholder="Name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        data-testid="workspace-create"
        disabled={!name.trim()}
        onClick={onCreate}
      >
        Choose folder…
      </button>
    </div>
  </Fold>
);
