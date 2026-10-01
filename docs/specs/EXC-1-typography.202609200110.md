# Typography: font choice and size units
[sw-_file-verdict]: # '@validated(v=438052e7f0bee36faec8ee40051b3dd5ba907305, by="maintainer", at=2026-09-20)'

[sw-_file-status]: # '@status(value=open, at=2026-09-20)'

`FONT_FAMILY` is a 9-value numeric enum persisted in every text element
(`packages/common/src/constants.ts:133`). Size is 4 presets, 16/20/28/36 px
(`constants.ts:115`), plus a x1.1 relative step. No numeric entry, no unit.

Undecided, blocking every requirement below:
- font source: bundled webfonts, `queryLocalFonts`, or fetched Google Fonts
- `fontFamily` stays a numeric enum, or becomes a string and the file format migrates
- export carries the font file, or only its name
- dp density: fixed mdpi 1x, or a document setting

## Requirement: The font list is not limited to the bundled families

The font picker SHALL offer families beyond the 9 of `FONT_FAMILY`, from the source chosen above.

## Requirement: Font size is entered as a number

The font size control SHALL accept a typed numeric value, and SHALL keep the 4 presets as shortcuts.

## Requirement: A font size carries a unit

A text element SHALL record the unit its size is expressed in, `px` or `dp`, and the canvas SHALL render both at the same device size for density 1x.

**Why:** dp = px / (dpi / 160); without a recorded unit the number is unreadable off the machine that typed it.
