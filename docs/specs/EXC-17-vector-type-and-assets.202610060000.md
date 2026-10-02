# Vector type, image tracing, font library, illustrations
[sw-_file-verdict]: # '@validated(by="maintainer", at=2026-10-06)'

[sw-_file-status]: # '@status(value=open, at=2026-10-06)'

Goal: better vector design than the original: real type, text and bitmaps as editable shapes, a font library with licences, illustrations and a default look worth showing.

## Requirement: Text to vectors
"Create outlines" (Type section, context menu) SHALL turn each selected text (also a text bound to a shape) into path elements, one group of one path per glyph, holes kept, laid out as on the canvas (line height, alignment, rotation), in the text colour; characters no font draws SHALL be reported and left out. Outlines come from the font files the app ships (library fonts: the face of the text's weight and style; the registered families otherwise), read with opentype.js; woff2 is decoded in the subsetting worker. Substitutions (ligatures, contextual forms) are not applied, so scripts that need them are not shaped.

## Requirement: Bold and italic
Texts SHALL have optional `fontWeight` (100 to 900, default regular) and `fontStyle` (`italic`), part of the font string (so measuring, canvas and SVG export agree), toggled by B and I buttons of the Type section and Ctrl+B / Ctrl+I (also while editing). A family without the face is emboldened or slanted by the browser; outlines fake it with an outline and a shear. In a library font the real faces load first.

## Requirement: Font library
The app SHALL ship open-licence families (`public/fonts/library`, a manifest with licence, source and version per family, `LICENSES.md`, the licence text beside the files); only OFL, Apache, MIT, Ubuntu, CC0 and UFL families are taken. A text uses one by name (`fontFamilyName`); faces load when first needed, SVG exports inline the subset actually used. `scripts/fonts/add-fonts.mjs` vendors any Fontsource family (`--curated`: the 85 families of the starter set; `--all`: every family of Fontsource, GBs; `--weights`, `--subsets`). The starter set carries latin glyphs only.

## Requirement: Vectorize images
"Vectorize" (Design section, context menu) SHALL trace a picture into path elements next to it: palette from the picture's own colours (farthest-point selection with k-means), outlines relaxed and fitted with Bézier curves except at sharp corners, holes kept, seams closed with a hairline of the same colour; choices are the number of colours and the smoothing. It is deterministic.

## Requirement: Illustrations
Symbols → Art SHALL offer flat vector illustrations drawn for the app (original artwork); inserting one makes ordinary editable paths in a group.

## Requirement: Defaults
The default symbol theme is "Pop" (white sheets, coral accent, round shapes). Links of a flow are drawn in the accent colour so they read on light and dark canvases.

## Open
Font library: more subsets (latin-ext, cyrillic, greek), variable fonts, fonts of the workspace folder; shaping of complex scripts; vectorize: a path-merging pass, transparency, gradients; illustrations: more, themable colours.
