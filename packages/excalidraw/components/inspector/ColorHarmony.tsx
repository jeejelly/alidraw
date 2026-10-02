import { useRef, useState } from "react";

import {
  HARMONIES,
  PALETTE_PRESETS,
  harmony,
  harmonyAngles,
  hexToHsv,
  hsvToHex,
  mostVivid,
  type HarmonyRule,
  type PalettePreset,
} from "../../color/harmony";
import { buildPalette } from "../../image/palette";
import { loadPixels } from "../../image/loadPixels";
import { rgbToHex } from "../../color/harmony";

import { ColorField } from "./ColorField";

import type App from "../App";

/** what a result can be used for, set by the place the picker is shown in */
export type HarmonyAction = {
  id: string;
  label: string;
  title?: string;
  run: (colors: string[], base: string, rule: HarmonyRule) => void;
};

const WHEEL = 156;

/** a tiny wheel showing where the colours of a rule sit */
const RuleIcon = ({ rule }: { rule: HarmonyRule }) => {
  const angles = harmonyAngles(rule);
  const c = 14;
  const r = 9;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle
        cx={c}
        cy={c}
        r={r + 2}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      {rule === "shades" || rule === "monochromatic"
        ? [-6, -3, 0, 3, 6].map((d, i) => (
            <circle
              key={i}
              cx={c + d * 1.6}
              cy={c}
              r={i === 2 ? 2.6 : 2}
              fill="currentColor"
              fillOpacity={0.35 + i * 0.15}
            />
          ))
        : angles.map((a, i) => {
            const rad = ((a - 90) * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={c + Math.cos(rad) * r}
                cy={c + Math.sin(rad) * r}
                r={i === 0 || a === 0 ? 2.6 : 2}
                fill="currentColor"
              />
            );
          })}
    </svg>
  );
};

/**
 * Colours that go together: a wheel with the base colour and the rest of a
 * harmony (analogous, triad, complementary…), ready-made palettes, and the
 * colours of a picture. The result can be kept as swatches or used as a theme.
 */
export const ColorHarmony = ({
  app,
  initial,
  actions,
}: {
  app: App;
  initial: string;
  actions: HarmonyAction[];
}) => {
  const [tab, setTab] = useState<"wheel" | "presets" | "image">("wheel");
  const [rule, setRule] = useState<HarmonyRule>("analogous");
  const start = hexToHsv(initial);
  const [hue, setHue] = useState(start.h);
  const [sat, setSat] = useState(start.s);
  const [val, setVal] = useState(start.v);
  const [preset, setPreset] = useState<PalettePreset>(PALETTE_PRESETS[0]);
  const [fromImage, setFromImage] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const wheel = useRef<HTMLDivElement>(null);

  const base = hsvToHex({ h: hue, s: sat, v: val });
  const { colors, index } = harmony(base, rule);

  const setBase = (hex: string) => {
    const hsv = hexToHsv(hex);
    setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v);
  };

  const pointAt = (e: { clientX: number; clientY: number }) => {
    const box = wheel.current!.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    const radius = Math.min(1, Math.hypot(dx, dy) / (box.width / 2));
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    setHue((angle + 360) % 360);
    setSat(radius * 100);
  };

  const handle = (hex: string) => {
    const hsv = hexToHsv(hex);
    const rad = ((hsv.h - 90) * Math.PI) / 180;
    const r = (hsv.s / 100) * (WHEEL / 2);
    return {
      x: WHEEL / 2 + Math.cos(rad) * r,
      y: WHEEL / 2 + Math.sin(rad) * r,
    };
  };

  const shown =
    tab === "presets"
      ? preset.colors
      : tab === "image"
      ? fromImage ?? []
      : colors;

  const extract = async () => {
    const image = app.scene
      .getSelectedElements(app.state)
      .find((e) => e.type === "image") as any;
    const file = image && app.files[image.fileId];
    if (!file) {
      setNote("Select a picture on the canvas first.");
      return;
    }
    try {
      const pixels = await loadPixels(file.dataURL, 200);
      const palette = buildPalette(pixels.data, 6).map((c) =>
        rgbToHex(c.r, c.g, c.b),
      );
      setFromImage(palette);
      setNote(null);
    } catch (e: any) {
      setNote(e?.message ?? "The picture could not be read.");
    }
  };

  return (
    <div className="harmony" data-testid="harmony">
      <div className="harmony__tabs" role="tablist">
        {(["wheel", "presets", "image"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-testid={`harmony-tab-${id}`}
            onClick={() => setTab(id)}
          >
            {id === "wheel"
              ? "Wheel"
              : id === "presets"
              ? "Palettes"
              : "Picture"}
          </button>
        ))}
      </div>

      {tab === "wheel" && (
        <>
          <div
            className="harmony__wheelbox"
            style={{ width: WHEEL, height: WHEEL }}
          >
            <div
              ref={wheel}
              className="harmony__wheel"
              data-testid="harmony-wheel"
              style={{
                width: WHEEL,
                height: WHEEL,
                filter: `brightness(${0.35 + (val / 100) * 0.65})`,
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                pointAt(e);
              }}
              onPointerMove={(e) => e.buttons && pointAt(e)}
            />
            <svg
              className="harmony__lines"
              width={WHEEL}
              height={WHEEL}
              aria-hidden="true"
            >
              {colors.map((c, i) => {
                const p = handle(c);
                return (
                  <line
                    key={i}
                    x1={WHEEL / 2}
                    y1={WHEEL / 2}
                    x2={p.x}
                    y2={p.y}
                    stroke="#fff"
                    strokeOpacity=".8"
                    strokeWidth="1.5"
                  />
                );
              })}
              {colors.map((c, i) => {
                const p = handle(c);
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={i === index ? 8 : 6}
                    fill={c}
                    stroke={i === index ? "#14142b" : "#fff"}
                    strokeWidth={i === index ? 2.5 : 2}
                  />
                );
              })}
            </svg>
          </div>
          <div className="harmony__rules" role="group" aria-label="Harmony">
            {HARMONIES.map((h) => (
              <button
                key={h.id}
                type="button"
                title={`${h.label}: ${h.hint}`}
                aria-label={h.label}
                aria-pressed={rule === h.id}
                data-testid={`harmony-rule-${h.id}`}
                onClick={() => setRule(h.id)}
              >
                <RuleIcon rule={h.id} />
              </button>
            ))}
          </div>
          <div className="harmony__name">
            {HARMONIES.find((h) => h.id === rule)!.label}
          </div>
          <label className="harmony__brightness">
            <span>Brightness</span>
            <input
              type="range"
              min={5}
              max={100}
              value={val}
              data-testid="harmony-brightness"
              onChange={(e) => setVal(Number(e.target.value))}
            />
          </label>
          <ColorField
            compact
            label="Base colour"
            testId="harmony-base"
            value={base}
            onChange={setBase}
          />
        </>
      )}

      {tab === "presets" && (
        <div className="harmony__presets" data-testid="harmony-presets">
          <div className="harmony__cards">
            {PALETTE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="harmony__card"
                aria-pressed={p.id === preset.id}
                data-testid="harmony-preset"
                title={p.name}
                onClick={() => setPreset(p)}
              >
                <span className="harmony__strip">
                  {p.colors.slice(0, 8).map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <span className="harmony__cardname">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "image" && (
        <div className="harmony__image">
          <button
            type="button"
            className="inspector__action"
            data-testid="harmony-extract"
            onClick={extract}
          >
            Colours of the selected picture
          </button>
          {note && <p className="symbols__note">{note}</p>}
        </div>
      )}

      {shown.length > 0 && (
        <div className="harmony__result" data-testid="harmony-result">
          {shown.map((c, i) => (
            <button
              key={`${c}${i}`}
              type="button"
              className={`harmony__chip${
                tab === "wheel" && i === index ? " is-base" : ""
              }`}
              style={{ background: c }}
              title={`${c}: use as the base`}
              aria-label={c}
              data-testid="harmony-chip"
              onClick={() => {
                setBase(c);
                setTab("wheel");
              }}
            />
          ))}
        </div>
      )}

      <div className="harmony__actions">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className="inspector__action"
            data-testid={`harmony-action-${a.id}`}
            title={a.title}
            disabled={!shown.length}
            onClick={() =>
              a.run(shown, tab === "wheel" ? base : mostVivid(shown), rule)
            }
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
};
