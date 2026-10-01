# Flows: screens, steps and links with a Mermaid source view
[sw-_file-verdict]: # '@validated(by="maintainer", at=2026-10-04)'

[sw-_file-status]: # '@status(value=open, at=2026-10-04)'

Goal: describe what happens when clicking here or there (UI behaviour, algorithms, workflows, architectures) on the design itself. A flow is a graph of screens, steps (hotspots) and links, drawn on the canvas and written as Mermaid text, each following the other.

## Requirement: Canvas and text are one flow
Frames SHALL be screens, rectangles/diamonds/ellipses steps, arrows glued to two steps links; membership SHALL live in `customData.flow` (`{id, key, kind}`) and save with the file. The Flow tab SHALL show the Mermaid flowchart of a flow (subgraph = screen), and editing it SHALL redraw the canvas, editing the canvas SHALL rewrite the text.

## Requirement: Edits keep the design
Steps that stay SHALL keep position, size and style (only a changed label or shape is touched); new steps SHALL be placed next to the step they link to; links SHALL be redrawn glued to their steps, keeping colour; screens SHALL grow to hold their steps.

## Requirement: Errors do not destroy
Text that cannot be read SHALL be reported by line and SHALL leave the canvas unchanged; unsupported statements (classDef, click, ...) SHALL be reported and left out.

## Requirement: Adopt what is drawn
Selected shapes and frames SHALL be added to a flow, becoming steps and screens with keys from their labels; arrows between them become its links.

## Open
Play mode (step through a flow, highlight the trigger, pan to the target); trigger kinds (click, hover, submit); links to screens (subgraph) and to non-shape elements; state, sequence and architecture diagram types; export as Markdown walkthrough.
