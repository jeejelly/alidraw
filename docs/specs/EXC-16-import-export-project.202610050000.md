# Import, export and the project browser

## Purpose
A design moves between tools: files come in, drawings go out, and a project holds many scenes. This adds the missing pieces without replacing the current design.

## Requirement: Import
The app SHALL add SVG files and pictures to the current design instead of replacing it (menu item, a way out of the "load from file" warning, and the Project tab). An SVG SHALL become editable shapes by default (paths with their curves and arcs, rectangles, circles, lines, polygons, text; colours, stroke widths, opacity and transforms; filled outlines with holes), grouped as one; it MAY instead be placed as a picture. What cannot be drawn (images, clip paths, masks, filters) SHALL be named in the message. Pictures SHALL be placed through the usual image path, so the workspace's linked or embedded policy applies.

## Requirement: PDF export
The export dialog SHALL offer a vector PDF. The desktop app SHALL render the SVG export in a window with no network and no scripts and save the result through a file dialog; a browser SHALL open the print dialog on the same page, where "Save as PDF" gives the same file. Shapes SHALL stay vector and text SHALL stay text with its font embedded, so other editors can open and change it. SVG export is unchanged: plain paths and shapes (fonts are embedded as CSS, which some editors ignore, so text there uses a fallback font).

## Requirement: Code
For symbols the app SHALL write starting code: HTML with CSS and Jetpack Compose, from the selection or from every symbol, top to bottom, using the component's label, settings, width and the theme's colours and corner style. A component without a mapping SHALL come out as a commented placeholder and be named. Text SHALL be escaped.

## Requirement: Project tab
In the desktop app the palette SHALL carry a Project tab: the workspace, its scenes as folders and files (open, rename, duplicate, delete), the version state (branch, changes, to push, to pull), commit with a message, check for updates, pull, push and sync, the history of the open scene, and the pictures kept with the project (put one on the canvas). A scene SHALL never be renamed over another file, and a delete SHALL be confirmed (git keeps the history). Hosts add tabs to the palette through `registerPaletteTab`.

## Requirement: Swatches
Swatches SHALL be a grid of small squares: click to apply, drag to reorder, drop on the fill or stroke to apply, and edit with the same colour field used everywhere in the palette.

## Requirement: PDF options
The PDF export SHALL offer the page (the size of the drawing, A5, A4, A3, Letter, Legal), the orientation, a margin in mm, and fit-to-page or actual size (several pages when needed). A drawing too big for a page SHALL be scaled down, never refused.

## Requirement: The whole canvas as code
Besides components, the Code section SHALL export the whole canvas as a page (HTML) or a Compose function, each part at the place it has on the canvas: symbols as their components, boxes, ellipses and text as positioned elements, paths and lines as inline SVG (a TODO in Compose). The file SHALL say it is positioned from the canvas and not a responsive layout, and name what was left out.

## Requirement: Library
Right-clicking a selection SHALL offer to replace it with an item of the library, which takes the selection's place and size: a component stretches like it does with Ctrl + drag, other shapes scale in proportion. Copies of a symbol (duplicates, items from the library) SHALL be their own components.

## Requirement: Files
The menu SHALL offer "New canvas" (offering to save the current one first) instead of "Reset", and, in the desktop app, "Save a copy…" and "Save as" into the workspace under a chosen name and folder. Swatches SHALL export as .gpl and .ase as well as import.

## Requirement: Workspaces inside a repository
A workspace folder inside a bigger git repository SHALL show, commit and restore only its own folder, with paths relative to it.

## Status
Built and tested. The PDF path was run in the desktop engine: one page of the right size, curves and a real font, with a script in the SVG ignored.
