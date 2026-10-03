const Icon = ({ path, size = 18 }: { path: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={path} />
  </svg>
);

const ICON_PATHS = {
  plus: "M12 5v14M5 12h14",
  pencil: "M4 20l1-5L16 4l4 4L9 19zM14 6l4 4",
  copy: "M8.5 8.5h11v11h-11zM15.5 8.5V5h-11v11h4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  folder:
    "M3 6.5C3 5.7 3.7 5 4.5 5H9.5L11.5 7.5H19.5C20.3 7.5 21 8.2 21 9V18C21 18.8 20.3 19.5 19.5 19.5H4.5C3.7 19.5 3 18.8 3 18Z",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1",
  refresh: "M20 12a8 8 0 01-14 5.3M4 12a8 8 0 0114-5.3M20 4v5h-5M4 20v-5h5",
  down: "M12 4v11M7 10.5l5 5 5-5M4 20h16",
  up: "M12 16V5M7 9.5l5-5 5 5M4 20h16",
  check: "M5 12.5l5 5L19 7",
  image:
    "M3 5h18v14H3zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM3.5 17l5.5-5 4 4 3-3 4.5 4.5",
};

export const ImageIcon = () => <Icon path={ICON_PATHS.image} />;

export const IconButton = ({
  icon,
  title,
  onClick,
  disabled,
  testId,
}: {
  icon: keyof typeof ICON_PATHS;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) => (
  <button
    type="button"
    className="project__icon"
    title={title}
    aria-label={title}
    data-testid={testId}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon path={ICON_PATHS[icon]} />
  </button>
);
