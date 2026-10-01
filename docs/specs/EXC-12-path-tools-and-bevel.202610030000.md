# Path tools in the inspector, bevel, readable icons
[sw-_file-verdict]: # '@validated(by="maintainer", at=2026-10-03)'

[sw-_file-status]: # '@status(value=done, at=2026-10-03)'

## Requirement: Standard icons
Align and distribute SHALL use the editor's own icons; Pathfinder SHALL use Venn-style glyphs (unite, minus front, intersect, exclude, divide, compound, release).

## Requirement: Path tools one click away
The inspector SHALL have a Path section: pen, knife, edit points, convert to path, join.

## Requirement: A line is a path
A straight line SHALL convert to a path as drawn (same anchors, polygon becomes closed).

## Requirement: Bevel
A straight corner SHALL take a `radius` (on the anchor's handle record): rendered, hit-tested and combined as an arc while the anchor stays editable and in place; the radius SHALL be clamped by the neighbouring sides, and curved corners and open ends SHALL be left alone. The inspector SHALL set it for all anchors (global) and for the selected anchor (local), and expose Edges sharp/round for shapes.

## Requirement: Rounded shapes in Pathfinder
A rectangle or diamond with rounded edges SHALL enter Pathfinder with its rounding, so the pieces of a cut keep their rounded outer corners and get straight cut edges; the rounding of a rectangle or diamond SHALL be a parametric radius (slider) as well as sharp/round.

## Requirement: Live corners
Corner mode (Shift+B, palette icon) SHALL show a circle gizmo on every straight corner of the selected rectangle, diamond or path; dragging one along the corner's bisector SHALL set that corner's radius (Shift: all corners); a rectangle or diamond SHALL become a path on the first change, keeping its rounding.
