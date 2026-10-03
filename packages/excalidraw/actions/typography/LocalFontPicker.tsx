import { useState } from "react";

import {
  filterFontFamilies,
  getLocalFontFamilies,
  isLocalFontAccessSupported,
} from "../../fonts/localFonts";
import { t } from "../../i18n";

export const LocalFontPicker = ({
  current,
  onSelect,
}: {
  current: string | null;
  onSelect: (name: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [families, setFamilies] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");

  if (!isLocalFontAccessSupported()) {
    return null;
  }

  const show = async () => {
    setOpen((isOpen) => !isOpen);
    if (families === null) {
      setFamilies(await getLocalFontFamilies());
    }
  };

  const list = filterFontFamilies(families ?? [], query).slice(0, 200);

  return (
    <div className="local-font-picker" style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="local-font-button"
        onClick={show}
        style={{ width: "100%", textAlign: "left" }}
        title={t("labels.localFont")}
      >
        {current ?? t("labels.localFont")}
      </button>
      {open && (
        <div
          data-testid="local-font-list"
          style={{
            position: "absolute",
            zIndex: 10,
            marginTop: 4,
            width: "100%",
            maxHeight: 260,
            overflow: "auto",
            background: "var(--island-bg-color)",
            boxShadow: "var(--shadow-island)",
            borderRadius: 6,
            padding: 4,
          }}
        >
          <input
            autoFocus
            type="text"
            value={query}
            placeholder={t("labels.localFontSearch")}
            onChange={(changeEvent) => setQuery(changeEvent.target.value)}
            onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
            style={{ width: "100%", marginBottom: 4 }}
          />
          {current && (
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              {t("labels.localFontClear")}
            </button>
          )}
          {families !== null && list.length === 0 && (
            <div style={{ padding: 6 }}>{t("labels.localFontNone")}</div>
          )}
          {list.map((family) => (
            <button
              key={family}
              type="button"
              data-testid="local-font-item"
              onClick={() => {
                onSelect(family);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                fontFamily: `"${family}"`,
              }}
            >
              {family}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
