import type { ReactNode } from "react";

/** Venn-style glyphs for the boolean operations: two overlapping squares, the
 * part the operation keeps filled, the rest outlined */
const SQUARE_A = "M3 3H15V15H3Z";
const SQUARE_B = "M9 9H21V21H9Z";
const A_ONLY = "M3 3H15V9H9V15H3Z";
const B_ONLY = "M15 9H21V21H9V15H15Z";
const BOTH = "M9 9H15V15H9Z";
const UNION = "M3 3H15V9H21V21H9V15H3Z";

const GLYPHS: Record<string, ReactNode> = {
  unite: <path d={UNION} fill="currentColor" />,
  subtract: (
    <>
      <path d={A_ONLY} fill="currentColor" />
      <path d={SQUARE_B} fill="none" />
    </>
  ),
  intersect: (
    <>
      <path d={SQUARE_A} fill="none" />
      <path d={SQUARE_B} fill="none" />
      <path d={BOTH} fill="currentColor" />
    </>
  ),
  exclude: (
    <>
      <path d={A_ONLY} fill="currentColor" />
      <path d={B_ONLY} fill="currentColor" />
      <path d={BOTH} fill="none" />
    </>
  ),
  divide: (
    <>
      <path d={A_ONLY} fill="none" />
      <path d={B_ONLY} fill="none" />
      <path d={BOTH} fill="currentColor" fillOpacity={0.35} />
    </>
  ),
  compound: (
    <path
      d="M3 3H21V21H3Z M8 8V16H16V8Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  ),
  release: (
    <>
      <path d="M3 3H21V21H3Z" fill="none" strokeDasharray="3 2" />
      <path d="M8 8H16V16H8Z" fill="none" />
    </>
  ),
};

export const PathfinderIcon = ({ op }: { op: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {GLYPHS[op]}
  </svg>
);

/** the path-editing glyphs, drawn at the same size as the tool icons */
export const PathActionIcon = ({
  kind,
}: {
  kind: "edit" | "convert" | "join" | "corner";
}) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {kind === "edit" && (
      <>
        <path d="M4 18C8 18 8 6 12 6S16 18 20 18" />
        <rect x="2.5" y="16.5" width="3" height="3" fill="currentColor" />
        <rect x="10.5" y="4.5" width="3" height="3" fill="currentColor" />
        <rect x="18.5" y="16.5" width="3" height="3" fill="currentColor" />
      </>
    )}
    {kind === "convert" && (
      <>
        <rect x="3" y="3" width="8" height="8" rx="0" />
        <path d="M13 21C13 15 21 17 21 11" />
        <path d="M13 8h6M16 5l3 3-3 3" />
      </>
    )}
    {kind === "corner" && (
      <>
        <path d="M4 20V10a6 6 0 0 1 6-6h10" />
        <circle cx="10.5" cy="10.5" r="3" strokeDasharray="2 2" />
        <circle cx="10.5" cy="10.5" r="1" fill="currentColor" />
      </>
    )}
    {kind === "join" && (
      <>
        <path d="M3 17L9 11" />
        <path d="M15 13L21 7" />
        <circle cx="9" cy="11" r="1.6" fill="currentColor" />
        <circle cx="15" cy="13" r="1.6" fill="currentColor" />
        <path d="M10.5 11.8l3 0.4" strokeDasharray="1.5 2" />
      </>
    )}
  </svg>
);
