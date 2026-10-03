export type LayoutKind = "auto" | "start" | "center" | "end" | "scale";

/** A 20px icon: a frame and where the content sits in it when stretched along an axis. */
export const LayoutIcon = ({
  kind,
  vertical,
}: {
  kind: LayoutKind;
  vertical?: boolean;
}) => {
  // a 16 x 12 frame; sizes are (along the axis, across it)
  const along = 16;
  const across = 12;
  const originX = vertical ? 4 : 2;
  const originY = vertical ? 2 : 4;
  const rect = (
    alongStart: number,
    acrossStart: number,
    alongSize: number,
    acrossSize: number,
  ) =>
    vertical
      ? {
          x: originX + acrossStart,
          y: originY + alongStart,
          width: acrossSize,
          height: alongSize,
        }
      : {
          x: originX + alongStart,
          y: originY + acrossStart,
          width: alongSize,
          height: acrossSize,
        };
  const line = (
    alongFrom: number,
    acrossFrom: number,
    alongTo: number,
    acrossTo: number,
  ) =>
    vertical
      ? {
          x1: originX + acrossFrom,
          y1: originY + alongFrom,
          x2: originX + acrossTo,
          y2: originY + alongTo,
        }
      : {
          x1: originX + alongFrom,
          y1: originY + acrossFrom,
          x2: originX + alongTo,
          y2: originY + acrossTo,
        };
  const block = 4;
  const thick = 6;
  const mid = (across - thick) / 2;
  const solid = { fill: "currentColor", stroke: "none" };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <rect
        {...rect(0, 0, along, across)}
        rx="1.5"
        strokeDasharray="2 2"
        opacity="0.55"
      />
      {kind === "auto" && (
        <>
          <rect {...rect(1.5, mid, block, thick)} {...solid} />
          <rect {...rect(along - 1.5 - block, mid, block, thick)} {...solid} />
          <line
            {...line(1.5 + block, across / 2, along - 1.5 - block, across / 2)}
          />
        </>
      )}
      {kind === "start" && (
        <rect {...rect(1.5, mid, block + 1, thick)} {...solid} />
      )}
      {kind === "center" && (
        <rect
          {...rect((along - block - 1) / 2, mid, block + 1, thick)}
          {...solid}
        />
      )}
      {kind === "end" && (
        <rect
          {...rect(along - 1.5 - block - 1, mid, block + 1, thick)}
          {...solid}
        />
      )}
      {kind === "scale" && (
        <>
          <rect
            {...rect(4, 3, along - 8, across - 6)}
            {...solid}
            opacity="0.85"
          />
          <line {...line(0.8, across / 2, 3.2, across / 2)} />
          <line {...line(along - 3.2, across / 2, along - 0.8, across / 2)} />
        </>
      )}
    </svg>
  );
};
