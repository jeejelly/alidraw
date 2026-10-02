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

## Requirement: Flow elements wrap what is drawn
"Convert to flow element" (Flow tab, context menu, action `convertToFlowElement`) SHALL wrap the selection (an object, a group, or other flow elements) in a dashed outline with a label above and a handle on its edge, all in one group with the wrapped objects, so they stay as editable as before. The outline is the step (`customData.flow` `{kind:"node", wrap:true, group}`), the label text its Mermaid label, and they SHALL read and write like any step. A flow element wrapped by another one SHALL read as a screen (nested `subgraph`) holding it; links SHALL be allowed to and from screens made this way.

## Requirement: Link by dragging the handle
Dragging a handle and releasing SHALL link to the flow element under the pointer (the smallest one around it, never the source or one holding it); on another object, SHALL wrap that object and link to it; on nothing, SHALL leave a placeholder flow element (a grey box) at that place, with its own handle, linked. Selecting a placeholder together with real objects and converting SHALL move the objects into its place and drop the box, keeping its label and links. A click on the handle SHALL do nothing. Links keep optional labels (double click the arrow).

## Requirement: Text edits keep the drawing
Editing the Mermaid text SHALL only relabel a flow element; dropping its step from the text SHALL remove the outline, label, handle, placeholder box and its links, and leave the wrapped objects, ungrouped. Steps typed in the text are still plain shapes; to put one in a screen made of flow elements, nest it on the canvas (the text reports it).

## Open
Play mode (step through a flow, highlight the trigger, pan to the target); trigger kinds (click, hover, submit); links to screens (subgraph) and to non-shape elements; state, sequence and architecture diagram types; export as Markdown walkthrough.
