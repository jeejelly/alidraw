# Compound shapes (holes)
[sw-_file-verdict]: # '@validated(by="jeejelly", at=2026-10-01)'

[sw-_file-status]: # '@status(value=done, at=2026-10-01)'

A shape is the combination of paths: a path element with extra closed outlines (`contours`); a hole is an outline inside another.

## Requirement: Holes from boolean results
Pathfinder and the knife SHALL group result loops by nesting: outers become shapes, nested outlines their holes.

## Requirement: Make and release
Make compound shape (Ctrl+8) SHALL merge selected shapes into one; Release (Ctrl+Alt+8) SHALL split it back.

## Requirement: Whole-shape behaviour
Move, scale, skew, bounds, fit-to-grid and save/restore SHALL carry the contours; restore SHALL drop invalid contours.

## Requirement: Holes are editable and hit-tested
The path editor SHALL select, drag, insert and delete points on any outline (`editingPath.loop`); a click inside a hole SHALL NOT hit the shape.
