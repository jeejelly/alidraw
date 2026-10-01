# Pathfinder boolean operations
[sw-_file-verdict]: # '@validated(by="jeejelly", at=2026-10-01)'

[sw-_file-status]: # '@status(value=done, at=2026-10-01)'

Boolean operations on closed shapes (paper.js, loaded lazily).

## Requirement: Operations
Unite, Intersect, Subtract, Exclude and Divide SHALL replace the selected closed shapes with path results; Unite/Intersect/Exclude take the top style, Subtract/Divide the bottom.

## Requirement: Precision
Rotated shapes SHALL take part where they really are; the result SHALL be one undo step.
