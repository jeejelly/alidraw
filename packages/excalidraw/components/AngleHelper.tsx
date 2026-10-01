import { ANGLE_HELPER_KEYS } from "../remarkableAngles";
import { t } from "../i18n";

/**
 * Shown while an angle gesture runs (rotating, the knife): the number keys
 * that lock it onto the angles people reach for, the held one lit.
 */
export const AngleHelper = ({ active }: { active: string | null }) => (
  <div
    data-testid="angle-helper"
    role="note"
    style={{
      position: "fixed",
      left: "50%",
      bottom: "4.5rem",
      transform: "translateX(-50%)",
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "0.35rem 0.6rem",
      borderRadius: 999,
      background: "var(--island-bg-color)",
      boxShadow: "var(--shadow-island)",
      color: "var(--text-primary-color)",
      fontSize: "0.75rem",
      zIndex: "var(--zIndex-layerUI, 4)" as any,
      pointerEvents: "none",
    }}
  >
    <span style={{ opacity: 0.6 }}>{t("labels.knife.keys")}</span>
    {ANGLE_HELPER_KEYS.map(([key, degrees]) => (
      <span
        key={key}
        data-testid={`angle-key-${key}`}
        aria-current={active === key}
        style={{
          display: "inline-flex",
          gap: 3,
          alignItems: "center",
          padding: "1px 6px",
          borderRadius: 999,
          background:
            active === key ? "var(--color-primary)" : "var(--button-gray-1)",
          color: active === key ? "#fff" : "inherit",
        }}
      >
        <b>{key}</b>
        {degrees}°
      </span>
    ))}
  </div>
);
