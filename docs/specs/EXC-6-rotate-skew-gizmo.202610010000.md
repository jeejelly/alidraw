# Rotate and skew gizmo
[sw-_file-verdict]: # '@validated(by="maintainer", at=2026-10-01)'

[sw-_file-status]: # '@status(value=done, at=2026-10-01)'

Blender-like gizmo: zones around the selection rotate or skew, with centre cross lines to catch the centre and align the angle to other objects.

## Requirement: Rotate and skew by zone
Dragging an outer zone SHALL rotate, an edge zone SHALL skew, with a live angle readout; Alt SHALL work from the centre; Escape SHALL cancel.

## Requirement: Angle priority
Rotation SHALL resolve in order: held angle key, Shift step, alignment to other elements, magnet to remarkable angles.

## Requirement: Clicks pass through
A click that never moves SHALL deselect or select as usual, never start a gizmo.
