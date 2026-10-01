# Symbols: icons and UI components, themable

## Purpose
Designing a screen needs ready parts: icons and the usual interface components (buttons, toggles, pills, tabs, collapsible bars, sliders, knobs, date and time pickers, lists, app bars, navigation, dialogs, sheets). The palette SHALL offer them in a Symbols tab, in the colours and corners of a theme the user controls.

## Requirement: Library
The app SHALL ship its own outline icons (over a hundred, in groups) and its own UI components, drawn as plain shapes and paths so they stay editable: rectangles, ellipses, lines, text and paths. Pill shapes SHALL be paths with a full corner bevel, so the corner tool still edits them. Each insertion SHALL be one group.

## Requirement: Parameters
A component MAY have parameters (label, state, value, number of rows or bars, which bars are open, width, kind). The panel SHALL show them with a live preview and insert exactly what the preview shows. Controls SHALL offer the states enabled, hover, focus, pressed and disabled.

## Requirement: Theme
A theme is colour tokens (page, surface, surface alt, border, text, muted, accent, on accent, success, danger), a corner style (sharp, soft, round) and a stroke width. Presets SHALL include light, dark, a dark theme with a pink accent, and a tonal light and dark pair. The user MAY change any token. Every inserted shape SHALL remember its tokens, so "apply to selection" and "apply to all symbols" recolour and re-round them without changing their size or place.

## Status
Built: icons, about fifty parametric components, themes, panel with search, categories, preview and parameters, insert and re-theme.
