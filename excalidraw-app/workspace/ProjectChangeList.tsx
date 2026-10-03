const MAX_SHOWN = 20;

/** what a git status code means, in a word */
const changeKind = (code: string) =>
  code === "??" || code.includes("A")
    ? "new"
    : code.includes("D")
    ? "deleted"
    : code.includes("R")
    ? "renamed"
    : "changed";

export const ProjectChangeList = ({
  changes,
}: {
  changes: { path: string; code: string }[];
}) => (
  <ul className="project__changes" data-testid="project-changes">
    {changes.slice(0, MAX_SHOWN).map((change) => {
      const kind = changeKind(change.code);
      const slash = change.path.lastIndexOf("/");
      return (
        <li key={change.path} title={change.path}>
          <span className={`project__tag project__tag--${kind}`}>{kind}</span>
          <span className="project__file">
            {slash >= 0 && (
              <span className="project__dir">
                {change.path.slice(0, slash + 1)}
              </span>
            )}
            {change.path.slice(slash + 1)}
          </span>
        </li>
      );
    })}
    {changes.length > MAX_SHOWN && <li>… {changes.length - MAX_SHOWN} more</li>}
  </ul>
);
