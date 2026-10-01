import type { ReactNode } from "react";

/** Venn-style glyphs for the boolean operations: two overlapping squares, the
 * part the operation keeps filled, the rest outlined */
const A = "M3 3H15V15H3Z";
const B = "M9 9H21V21H9Z";
const A_ONLY = "M3 3H15V9H9V15H3Z";
const B_ONLY = "M15 9H21V21H9V15H15Z";
const BOTH = "M9 9H15V15H9Z";
const UNION = "M3 3H15V9H21V21H9V15H3Z";

const GLYPHS: Record<string, ReactNode> = {
  unite: <path d={UNION} fill="currentColor" />,
  subtract: (
    <>
      <path d={A_ONLY} fill="currentColor" />
      <path d={B} fill="none" />
    </>
  ),
  intersect: (
    <>
      <path d={A} fill="none" />
      <path d={B} fill="none" />
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
