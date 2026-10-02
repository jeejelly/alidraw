# Crumbly: a fixture design

A social network about eating cookies, as a website and a phone app, designed only
with the app's own tools (themed symbols, flow elements, the Flow tab, code export):
`packages/excalidraw/tests/fixtures/crumbly.test.tsx`. No element is written by hand.

Regenerate these files (they are the result of the test, not hand edits):

    WRITE_FIXTURE=1 yarn vitest run packages/excalidraw/tests/fixtures

- `crumbly.excalidraw`: open it in the app (everything stays editable)
- `crumbly.svg` / `crumbly.png`: the design as drawn
- `crumbly.mmd`: the flow as Mermaid (screens, buttons, links)
- `crumbly.html`, `Crumbly.kt`: the code export (rows and columns)

The test also checks the design: nothing sticks out of its phone (it found the category
pills 50 px too wide), links reach screens from buttons, and a label added in the
Mermaid text leaves the drawing untouched.

The illustrations (`packages/excalidraw/illustrations/`) are original flat artwork drawn for this
app; inserted from Symbols → Art they become ordinary vector paths, every shape editable.
