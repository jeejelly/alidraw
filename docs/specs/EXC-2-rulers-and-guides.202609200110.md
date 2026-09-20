# Rulers and guides
[sw-_file-verdict]: # '@validated(v=73e0f7637610829dbdc6e2faa7b76b3c5216b712, by="jeejelly", at=2026-09-20)'

[sw-_file-status]: # '@status(value=open, at=2026-09-20)'

The canvas has no ruler, no guides, and no unit other than px.

Undecided: whether the ruler unit follows EXC-1 (`px`/`dp`) or is set on its own.

## Requirement: The canvas carries edge rulers

The canvas SHALL show a ruler along its top and left edges, graduated in the current unit, tracking zoom and scroll.

## Requirement: A guide is dragged off a ruler

Dragging from a ruler onto the canvas SHALL create a guide line, and a dragged element SHALL snap to it.

## Requirement: Guides are saved with the document

A guide SHALL survive save and reload.
