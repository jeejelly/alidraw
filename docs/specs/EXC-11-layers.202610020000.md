# Layers: named containers that own objects
[sw-_file-verdict]: # '@validated(by="jeejelly", at=2026-10-02)'

[sw-_file-status]: # '@status(value=done, at=2026-10-02)'

Illustrator model: a layer is a folder that owns objects, not a z-index. Membership is `customData.layerId` on the element; the ordered layer list (bottom to top) is `appState.layers`, saved with the file.

## Requirement: Layers own objects and order them
Every layer SHALL be a contiguous block of the stack (all objects of a layer above all objects of the layers below); new objects SHALL go to the active layer; creating the first layer SHALL put what is already drawn in "Layer 1".

## Requirement: Name, reorder, show, hide, lock
Layers SHALL be renameable (double click) and reorderable by drag; hiding SHALL hide, unselect and unpick the objects (data kept); locking SHALL lock every object of the layer.

## Requirement: Move and delete
Objects SHALL move between layers by drag onto a layer, landing on top of its block; deleting a layer SHALL delete the objects it owns.

## Requirement: Layer-level style
Fill, stroke and no-fill set on a layer SHALL restyle every object in it; the shared value SHALL show when all objects agree.

## Requirement: Inspector first
The inspector SHALL stay open when a scene is cleared or reset.

## Open
Sublayers; hidden layers are still exported; layer list edits are not in undo history (object changes are).
