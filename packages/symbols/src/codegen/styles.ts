import type { SymbolTheme } from "../theme";

export const rad = (theme: SymbolTheme, kind: "ctl" | "card") =>
  kind === "ctl"
    ? theme.radius >= 40
      ? 999
      : theme.radius
    : theme.radius >= 40
    ? 20
    : Math.min(28, Math.round(theme.radius * 1.5));

export const cssFor = (theme: SymbolTheme) => {
  const colors = theme.colors;
  const rc = rad(theme, "ctl");
  const rk = rad(theme, "card");
  return `:root {
  --page: ${colors.page}; --surface: ${colors.surface}; --surface-alt: ${colors.surfaceAlt};
  --border: ${colors.border}; --text: ${colors.text}; --muted: ${colors.muted};
  --accent: ${colors.accent}; --on-accent: ${colors.onAccent};
  --success: ${colors.success}; --danger: ${colors.danger};
  --radius: ${rc}px; --radius-card: ${rk}px; --stroke: ${theme.stroke}px;
}
body { margin: 0; padding: 16px; background: var(--page); color: var(--text); font-family: system-ui, sans-serif; }
.stack { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.row, .chips { display: flex; gap: 8px; }
button { font: inherit; cursor: pointer; }
.btn { height: 40px; padding: 0 20px; border-radius: var(--radius); border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.btn--filled { background: var(--accent); color: var(--on-accent); }
.btn--danger { background: var(--danger); color: var(--on-accent); }
.btn--tonal { background: var(--surface-alt); color: var(--text); }
.btn--outlined { background: transparent; color: var(--accent); border-color: var(--accent); }
.btn--text { background: transparent; color: var(--accent); }
.icon-btn { width: 40px; height: 40px; border-radius: 999px; border: 0; display: inline-grid; place-items: center; background: var(--accent); color: var(--on-accent); }
.icon-btn--soft { background: var(--surface-alt); color: var(--accent); }
.icon-btn--outline, .icon-btn--plain { background: transparent; color: var(--text); border: 1px solid var(--border); }
.fab { display: inline-flex; align-items: center; gap: 12px; min-width: 56px; height: 56px; padding: 0 16px; border: 0; border-radius: 16px; background: var(--accent); color: var(--on-accent); }
.field { display: flex; flex-direction: column; gap: 4px; }
.field__label, .field__helper { font-size: 12px; color: var(--muted); }
.field__input { height: 44px; padding: 0 12px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); color: var(--text); box-sizing: border-box; width: 100%; }
.field__input.is-error { border-color: var(--danger); }
.searchbar { display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 14px; border-radius: 999px; background: var(--surface-alt); box-sizing: border-box; }
.searchbar input { flex: 1; border: 0; background: transparent; font: inherit; color: inherit; outline: 0; }
.chip { height: 34px; padding: 0 14px; border-radius: var(--radius); border: 0; background: var(--surface-alt); color: var(--accent); }
.chip.is-active { background: var(--accent); color: var(--on-accent); }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; background: var(--success); color: var(--on-accent); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); overflow: hidden; }
.card h3, .card p { margin: 0; padding: 4px 16px; }
.card__media { height: 80px; background: var(--surface-alt); }
.tabs, .segmented { display: flex; }
.tabs button { padding: 10px 20px; background: transparent; border: 0; border-bottom: 3px solid transparent; color: var(--muted); }
.tabs [aria-selected="true"] { color: var(--accent); border-color: var(--accent); }
.segmented button { padding: 8px 16px; border: 1px solid var(--border); background: transparent; color: var(--text); }
.segmented [aria-pressed="true"] { background: var(--surface-alt); }
.appbar { display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 8px; background: var(--surface); }
.appbar h1 { font-size: 18px; margin: 0; }
.navbar { display: flex; justify-content: space-around; background: var(--surface); padding: 8px 0; }
.navbar a { display: flex; flex-direction: column; align-items: center; font-size: 11px; color: var(--muted); }
.navbar .is-active { color: var(--accent); }
.snackbar { display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; border-radius: var(--radius); background: var(--text); color: var(--page); }
.snackbar button { background: transparent; border: 0; color: var(--accent); }
.dialog { border: 1px solid var(--border); border-radius: var(--radius-card); background: var(--surface); color: var(--text); }
.dialog__actions { display: flex; justify-content: flex-end; gap: 8px; }
.menu, .list { list-style: none; margin: 0; padding: 8px 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.menu li, .list li { padding: 10px 16px; }
.list li span { display: block; font-size: 12px; color: var(--muted); }
progress { accent-color: var(--accent); }
.slider { accent-color: var(--accent); }
.switch { display: inline-flex; align-items: center; gap: 8px; }
`;
};

export const composeTheme = (theme: SymbolTheme) => {
  const colors = theme.colors;
  const col = (hex: string) =>
    `Color(0xFF${hex.replace("#", "").toUpperCase()})`;
  return `val AppColors = lightColorScheme(
    primary = ${col(colors.accent)},
    onPrimary = ${col(colors.onAccent)},
    secondaryContainer = ${col(colors.surfaceAlt)},
    surface = ${col(colors.surface)},
    background = ${col(colors.page)},
    onSurface = ${col(colors.text)},
    onSurfaceVariant = ${col(colors.muted)},
    outline = ${col(colors.border)},
    error = ${col(colors.danger)},
)`;
};
