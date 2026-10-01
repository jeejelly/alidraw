# Path editing with tangent handles
[sw-_file-verdict]: # '@validated(v=6643dc255daf129764909b7f513eb1877eae604e, by="maintainer", at=2026-09-20)'

[sw-_file-status]: # '@status(value=open, at=2026-09-20)'

A linear element stores `points: readonly LocalPoint[]` (`packages/element/src/types.ts:372`)
and one element-wide `roundness` flag (`types.ts:49`). Curves are derived at render time by
`deconstructLinearOrFreeDrawElement` and read back read-only
(`packages/element/src/linearElementEditor.ts:950-1009`): no tangent is stored, so the editor
can only drag anchors. Rectangle, ellipse and diamond are not paths; only path to shape exists
(`convertToShape.ts`).

Undecided, and the first thing to settle:
- schema: handles on the point record (every reader of `.points` changes, `binding.ts` is 91 KB);
  a parallel optional `handles?` array; or a new `path` element type
- must a file with handles still open in upstream Excalidraw, degraded to straight segments
- shape to path: one-way or reversible

## Requirement: A path point carries its own tangent handles

A path point SHALL record an incoming and an outgoing tangent handle, each optional, and the renderer SHALL draw the cubic they define.

## Requirement: A point is a corner or a smooth point

A point SHALL be switched between corner, smooth and broken tangents, and a smooth point's two handles SHALL stay collinear while either is dragged.

## Requirement: Points are inserted and deleted on the path

A point SHALL be inserted on a segment and deleted from the path without moving the rest of the geometry.

## Requirement: A shape is converted to an editable path

A rectangle, ellipse or diamond SHALL convert to a path whose points and handles are editable.

## Requirement: A file written before handles opens unchanged
[sw-a-file-written-before-handles-opens-unchanged-verdict]: # '@validated(v=6643dc255daf129764909b7f513eb1877eae604e, by="maintainer", at=2026-09-20)'

A document holding no handle SHALL render exactly as it does today.
