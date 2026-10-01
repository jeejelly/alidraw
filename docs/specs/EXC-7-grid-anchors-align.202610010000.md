# Grid, anchors and align
[sw-_file-verdict]: # '@validated(by="jeejelly", at=2026-10-01)'

[sw-_file-status]: # '@status(value=done, at=2026-10-01)'

Layout precision: user-defined grid spacing, anchoring and alignment.

## Requirement: Grid spacing and fit
The grid spacing SHALL be definable; Fit to grid SHALL snap selected elements to it.

## Requirement: Anchors
An element SHALL be anchored to a ruler guide or to another element (`customData.anchor`); a follower SHALL follow its target, a deliberate move SHALL update the gap, cycles SHALL be refused, and duplicates SHALL remap to the copy.

## Requirement: Align
An Align section SHALL align and distribute the selection.
