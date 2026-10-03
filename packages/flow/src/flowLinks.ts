export type LinkBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
};

/**
 * Both ends of a link: on the border of each step, on the line between their
 * centres, `shift` to the side so links between the same two steps don't overlap.
 */
export const linkEnds = (
  from: LinkBox,
  to: LinkBox,
  shift: number,
): [[number, number], [number, number]] => {
  const fromCentre = [from.x + from.w / 2, from.y + from.h / 2];
  const toCentre = [to.x + to.w / 2, to.y + to.h / 2];
  const dx = toCentre[0] - fromCentre[0];
  const dy = toCentre[1] - fromCentre[1];
  const length = Math.hypot(dx, dy) || 1;
  const sideX = (-dy / length) * shift;
  const sideY = (dx / length) * shift;
  // how far along (dx, dy) the border is, as a fraction of the centre distance
  const border = (box: LinkBox) => {
    const halfWidth = box.w / 2;
    const halfHeight = box.h / 2;
    const ratioX = Math.abs(dx) / halfWidth || 0;
    const ratioY = Math.abs(dy) / halfHeight || 0;
    const scale =
      box.type === "diamond"
        ? ratioX + ratioY
        : box.type === "ellipse"
        ? Math.hypot(ratioX, ratioY)
        : Math.max(ratioX, ratioY);
    return scale ? 1 / scale : 0;
  };
  const fromBorder = border(from);
  const toBorder = border(to);
  return [
    [
      fromCentre[0] + dx * fromBorder + sideX,
      fromCentre[1] + dy * fromBorder + sideY,
    ],
    [toCentre[0] - dx * toBorder + sideX, toCentre[1] - dy * toBorder + sideY],
  ];
};
