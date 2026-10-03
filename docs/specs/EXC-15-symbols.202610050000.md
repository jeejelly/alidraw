# Symbols: icons and UI components, themable

## Purpose
Designing a screen needs ready parts: icons and the usual interface components (buttons, toggles, pills, tabs, collapsible bars, sliders, knobs, date and time pickers, lists, app bars, navigation, dialogs, sheets). The palette SHALL offer them in a Symbols tab, in the colours and corners of a theme the user controls.

## Requirement: Library
The app SHALL ship its own outline icons (over a hundred, in groups) and its own UI components, drawn as plain shapes and paths so they stay editable: rectangles, ellipses, lines, text and paths. Pill shapes SHALL be paths with a full corner bevel, so the corner tool still edits them. Each insertion SHALL be one group.

## Requirement: Parameters
A component MAY have parameters (label, state, value, number of rows or bars, which bars are open, width, kind). The panel SHALL show them with a live preview and insert exactly what the preview shows. Controls SHALL offer the states enabled, hover, focus, pressed and disabled.

## Requirement: Theme
A theme is colour tokens (page, surface, surface alt, border, text, muted, accent, on accent, success, danger), a corner style (sharp, soft, round) and a stroke width. Presets SHALL include light, dark, a dark theme with a pink accent, and a tonal light and dark pair. The user MAY change any token. Every inserted shape SHALL remember its tokens, so "apply to selection" and "apply to all symbols" recolour and re-round them without changing their size or place.

## Requirement: Stretching
Ctrl + drag on an edge or handle of a whole component SHALL stretch it without distorting its content: parts that span the stretched side grow, parts at an end keep their distance from it, parts in the middle stay in the middle; round corners, icons and text keep their size. A component MAY choose its layout across and down (automatic, start, centre, end, scale), and one of its parts MAY be locked to the clipping zone so it always covers the whole component. An edge that lines up with another component SHALL snap and flash, with the aligned line shown.

## Requirement: Standing in for diagram shapes
A symbol MAY replace a shape of a diagram, taking the shape's text as its label and filling its box. The shape stays under it, unseen, so links glued to it keep working, and the symbol is redrawn when the text changes.

## Requirement: Grids and colour schemes
The library SHALL include layout grids (columns, baseline, square cells, device safe areas, thirds and golden ratio), and the Symbols tab SHALL list the reference colours of the current theme (its tokens and a ramp of its accent), to apply to a selection or keep in the swatches.

## Requirement: The palette
The palette SHALL stay on screen (collapsing to its title bar), carry every tool of the top bar and the switches of the preferences (snapping, rulers, grid, arrow binding, zen) as icons, and stretch both sideways and down.

## Status
Built: icons, about fifty parametric components, themes, panel with search, categories, preview and parameters, insert and re-theme.

## Requirement: Custom symbols
"Convert to symbol" (Symbols tab, context menu, action `convertToSymbol`) SHALL turn a drawing into a component without changing it: the elements get an innermost group, their position in the symbol and a list of parameters (`customData.symbol.params`, on part 0, with the current `values`). Parameters are suggested from the drawing (background = the fill covering most area, accent, outline, text colour, each text) and each one is a property (fill, outline, text, opacity, line width, visibility) of one or more parts. The Symbols tab sets them, renames and removes them; selecting a part inside the symbol exposes more (parts sharing a colour follow it). Because everything lives in the elements, copies, library items and files keep the parameters; stretching, layout and code export (positioned) work as for any symbol.

## Requirement: Diagram families

The library has four diagram families next to the UI components, each a themable parametric component with a label, a size and an accent colour: Flow (terminator, process, decision, input/output, for loop, while loop, predefined process, database, document, manual input, delay, display, connector, merge/fork-join, comment), State (initial, final, state with entry/exit actions, choice, fork/join, history, composite), Architecture (service, API gateway, message queue, database, cache, browser, mobile app, load balancer, cloud, actor, external system, trust boundary) and Programming (class, interface, function, module, API endpoint, DB table, note/code block). They are in `packages/symbols/src/parametric/{flow,state,architecture,programming}.ts`.

A component may declare `flow: { form?, shape?, ports?, labelParam }`. Inserting it from the panel then wraps it as a flow element (the flow of the selection, else the first, else "Flow 1") whose label is the `labelParam` value, so Mermaid writes it with its own bracket syntax (`db[("Users")]`) and a decision has the ports in/yes/no/other. A component without `flow` is inserted as before. Mermaid has no `for` or `while` element, so the two loop heads are written with the shapes it offers for loops: For loop is the hexagon (`{{"for each item"}}`), While loop the loop-limit shape (`@{ shape: notch-pent, label: "while condition" }`), each with the ports in / body / exit / back; the body and the way back are ordinary links. The symbols package keeps its own plain copies of the flow form and port types because the flow package depends on it.

