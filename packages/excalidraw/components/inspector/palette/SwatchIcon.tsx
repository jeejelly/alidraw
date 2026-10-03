export const SwatchIcon = ({
  kind,
}: {
  kind: "plus" | "pencil" | "upload" | "trash" | "download";
}) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {kind === "plus" && <path d="M12 5v14M5 12h14" />}
    {kind === "pencil" && <path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4" />}
    {kind === "upload" && <path d="M12 16V5M7 9.5L12 4.5l5 5M4 20h16" />}
    {kind === "download" && <path d="M12 4v11M7 10.5l5 5 5-5M4 20h16" />}
    {kind === "trash" && (
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    )}
  </svg>
);
