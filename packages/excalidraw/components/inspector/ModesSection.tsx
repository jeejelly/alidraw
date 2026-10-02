import {
  actionToggleArrowBinding,
  actionToggleGridMode,
  actionToggleGuidesSnap,
  actionToggleMidpointSnapping,
  actionToggleObjectsSnapMode,
  actionToggleRulers,
  actionToggleZenMode,
} from "../../actions";
import { t } from "../../i18n";

import { Section } from "./primitives";

import type App from "../App";

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const MODES = [
  {
    id: "snap-objects",
    action: actionToggleObjectsSnapMode,
    title: () => t("buttons.objectsSnapMode"),
    on: (s: App["state"]) => s.objectsSnapModeEnabled,
    // a magnet
    icon: (
      <Svg>
        <path d="M5 4v8a7 7 0 0 0 14 0V4h-4v8a3 3 0 0 1-6 0V4z" />
        <path d="M5 8h4M15 8h4" />
      </Svg>
    ),
  },
  {
    id: "snap-guides",
    action: actionToggleGuidesSnap,
    title: () => t("labels.rulers.snap"),
    on: (s: App["state"]) => s.guidesSnapEnabled,
    icon: (
      <Svg>
        <path d="M4 3v6a5 5 0 0 0 10 0V3h-3v6a2 2 0 0 1-4 0V3z" />
        <path d="M3 20h18" strokeDasharray="2 2.5" />
      </Svg>
    ),
  },
  {
    id: "rulers",
    action: actionToggleRulers,
    title: () => t("labels.rulers.toggle"),
    on: (s: App["state"]) => s.rulersEnabled,
    icon: (
      <Svg>
        <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
        <path d="M6 8v3M10 8v4M14 8v3M18 8v4" />
      </Svg>
    ),
  },
  {
    id: "grid",
    action: actionToggleGridMode,
    title: () => t("labels.toggleGrid"),
    on: (s: App["state"]) => s.gridModeEnabled,
    icon: (
      <Svg>
        <path d="M4 4h16v16H4zM4 12h16M12 4v16" />
      </Svg>
    ),
  },
  {
    id: "arrow-binding",
    action: actionToggleArrowBinding,
    title: () => t("labels.arrowBinding"),
    on: (s: App["state"]) => s.bindingPreference === "enabled",
    icon: (
      <Svg>
        <rect x="2.5" y="4" width="7" height="6" rx="1" />
        <rect x="14.5" y="14" width="7" height="6" rx="1" />
        <path d="M9.5 7H14a2 2 0 0 1 2 2v5M13.5 12l2.5 2.5 2.5-2.5" />
      </Svg>
    ),
  },
  {
    id: "midpoints",
    action: actionToggleMidpointSnapping,
    title: () => t("labels.midpointSnapping"),
    on: (s: App["state"]) => s.isMidpointSnappingEnabled,
    icon: (
      <Svg>
        <path d="M3 12h18" />
        <circle cx="12" cy="12" r="2.4" />
        <path d="M3 9v6M21 9v6" />
      </Svg>
    ),
  },
  {
    id: "zen",
    action: actionToggleZenMode,
    title: () => t("buttons.zenMode"),
    on: (s: App["state"]) => s.zenModeEnabled,
    icon: (
      <Svg>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8 13c1.5 2.4 6.5 2.4 8 0M9 9.5h.01M15 9.5h.01" />
      </Svg>
    ),
  },
];

/** the preferences that are switches, one click away: snapping, rulers, grid, binding */
export const ModesSection = ({ app }: { app: App }) => (
  <Section title={t("labels.palette.modes")} testId="inspector-modes">
    <div className="inspector__row" style={{ gap: 2, flexWrap: "wrap" }}>
      {MODES.map((m) => {
        const on = !!m.on(app.state);
        return (
          <button
            key={m.id}
            type="button"
            className="inspector__iconbtn"
            style={{ width: "2rem", height: "2rem" }}
            data-testid={`mode-${m.id}`}
            title={m.title()}
            aria-label={m.title()}
            aria-pressed={on}
            onClick={() => app.actionManager.executeAction(m.action, "ui")}
          >
            {m.icon}
          </button>
        );
      })}
    </div>
  </Section>
);
