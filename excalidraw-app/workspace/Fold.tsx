import { useState } from "react";

const FOLD_KEY = "workspace-folds";

const readFolds = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(FOLD_KEY) || "{}");
  } catch {
    return {};
  }
};

/** a collapsible block; its content stays mounted so state and tests survive */
export const Fold = ({
  id,
  title,
  badge,
  defaultOpen = true,
  actions,
  children,
}: {
  id: string;
  title: string;
  badge?: string | number | null;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const [open, setOpenState] = useState(() => readFolds()[id] ?? defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpenState(next);
    try {
      localStorage.setItem(
        FOLD_KEY,
        JSON.stringify({ ...readFolds(), [id]: next }),
      );
    } catch {}
  };
  return (
    <section className="workspace__fold" data-testid={`fold-${id}`}>
      <header>
        <button
          type="button"
          className="workspace__foldhead"
          aria-expanded={open}
          onClick={toggle}
        >
          <span className="workspace__chev">{open ? "▾" : "▸"}</span>
          <span>{title}</span>
          {badge != null && badge !== "" && (
            <span className="workspace__badge">{badge}</span>
          )}
        </button>
        {actions && <div className="workspace__foldactions">{actions}</div>}
      </header>
      <div className="workspace__foldbody" hidden={!open}>
        {children}
      </div>
    </section>
  );
};
