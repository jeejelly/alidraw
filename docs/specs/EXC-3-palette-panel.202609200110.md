# Palette panel
[sw-_file-verdict]: # '@validated(v=e9eedb5c424a529fddfa8b57f3f67d2e56c79a62, by="jeejelly", at=2026-09-20)'

[sw-_file-status]: # '@status(value=open, at=2026-09-20)'

`ColorPicker` is a popover bound to one property button
(`packages/excalidraw/components/ColorPicker/`). `CustomColorList` holds last-used colours only:
there is no user swatch library and no panel that stays open.

Undecided: swatches only or the full stroke/background set; per-document or app-wide storage;
`.ase`/`.gpl` import.

## Requirement: The palette stays open as a panel

The palette SHALL be a panel that remains open while elements are selected and edited, not a popover dismissed on use.

## Requirement: The panel is moved and oriented

The panel SHALL be draggable to any position over the canvas and SHALL switch between horizontal and vertical layout.

## Requirement: A swatch is added, named and removed

A colour SHALL be added to the palette as a swatch, given a name, and removed, and the set SHALL survive reload.
