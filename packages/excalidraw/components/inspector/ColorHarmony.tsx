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
} from "@excalidraw/color";
import { buildPalette } from "@excalidraw/color";
import { loadPixels } from "@excalidraw/vector";
import { rgbToHex } from "@excalidraw/color";

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
  const center = 14;
  const radius = 9;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle
        cx={center}
        cy={center}
        r={radius + 2}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      {rule === "shades" || rule === "monochromatic"
        ? [-6, -3, 0, 3, 6].map((offset, dotIndex) => (
            <circle
              key={dotIndex}
              cx={center + offset * 1.6}
              cy={center}
              r={dotIndex === 2 ? 2.6 : 2}
              fill="currentColor"
              fillOpacity={0.35 + dotIndex * 0.15}
            />
          ))
        : angles.map((angle, angleIndex) => {
            const rad = ((angle - 90) * Math.PI) / 180;
            return (
              <circle
                key={angleIndex}
                cx={center + Math.cos(rad) * radius}
                cy={center + Math.sin(rad) * radius}
                r={angleIndex === 0 || angle === 0 ? 2.6 : 2}
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

  const pointAt = (pointer: { clientX: number; clientY: number }) => {
    const box = wheel.current!.getBoundingClientRect();
    const dx = pointer.clientX - (box.left + box.width / 2);
    const dy = pointer.clientY - (box.top + box.height / 2);
    const radius = Math.min(1, Math.hypot(dx, dy) / (box.width / 2));
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    setHue((angle + 360) % 360);
    setSat(radius * 100);
  };

  const handle = (hex: string) => {
    const hsv = hexToHsv(hex);
    const rad = ((hsv.h - 90) * Math.PI) / 180;
    const radius = (hsv.s / 100) * (WHEEL / 2);
    return {
      x: WHEEL / 2 + Math.cos(rad) * radius,
      y: WHEEL / 2 + Math.sin(rad) * radius,
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
      .find((element) => element.type === "image") as any;
    const file = image && app.files[image.fileId];
    if (!file) {
      setNote("Select a picture on the canvas first.");
      return;
    }
    try {
      const pixels = await loadPixels(file.dataURL, 200);
      const palette = buildPalette(pixels.data, 6).map((swatch) =>
        rgbToHex(swatch.r, swatch.g, swatch.b),
      );
      setFromImage(palette);
      setNote(null);
    } catch (error: any) {
      setNote(error?.message ?? "The picture could not be read.");
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
              onPointerDown={(element) => {
                element.currentTarget.setPointerCapture(element.pointerId);
                pointAt(element);
              }}
              onPointerMove={(element) => element.buttons && pointAt(element)}
            />
            <svg
              className="harmony__lines"
              width={WHEEL}
              height={WHEEL}
              aria-hidden="true"
            >
              {colors.map((color, colorIndex) => {
                const point = handle(color);
                return (
                  <line
                    key={colorIndex}
                    x1={WHEEL / 2}
                    y1={WHEEL / 2}
                    x2={point.x}
                    y2={point.y}
                    stroke="#fff"
                    strokeOpacity=".8"
                    strokeWidth="1.5"
                  />
                );
              })}
              {colors.map((color, colorIndex) => {
                const point = handle(color);
                return (
                  <circle
                    key={colorIndex}
                    cx={point.x}
                    cy={point.y}
                    r={colorIndex === index ? 8 : 6}
                    fill={color}
                    stroke={colorIndex === index ? "#14142b" : "#fff"}
                    strokeWidth={colorIndex === index ? 2.5 : 2}
                  />
                );
              })}
            </svg>
          </div>
          <div className="harmony__rules" role="group" aria-label="Harmony">
            {HARMONIES.map((harmonyRule) => (
              <button
                key={harmonyRule.id}
                type="button"
                title={`${harmonyRule.label}: ${harmonyRule.hint}`}
                aria-label={harmonyRule.label}
                aria-pressed={rule === harmonyRule.id}
                data-testid={`harmony-rule-${harmonyRule.id}`}
                onClick={() => setRule(harmonyRule.id)}
              >
                <RuleIcon rule={harmonyRule.id} />
              </button>
            ))}
          </div>
          <div className="harmony__name">
            {HARMONIES.find((harmonyRule) => harmonyRule.id === rule)!.label}
          </div>
          <label className="harmony__brightness">
            <span>Brightness</span>
            <input
              type="range"
              min={5}
              max={100}
              value={val}
              data-testid="harmony-brightness"
              onChange={(element) => setVal(Number(element.target.value))}
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
            {PALETTE_PRESETS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="harmony__card"
                aria-pressed={option.id === preset.id}
                data-testid="harmony-preset"
                title={option.name}
                onClick={() => setPreset(option)}
              >
                <span className="harmony__strip">
                  {option.colors.slice(0, 8).map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
                <span className="harmony__cardname">{option.name}</span>
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
          {shown.map((color, colorIndex) => (
            <button
              key={`${color}${colorIndex}`}
              type="button"
              className={`harmony__chip${
                tab === "wheel" && colorIndex === index ? " is-base" : ""
              }`}
              style={{ background: color }}
              title={`${color}: use as the base`}
              aria-label={color}
              data-testid="harmony-chip"
              onClick={() => {
                setBase(color);
                setTab("wheel");
              }}
            />
          ))}
        </div>
      )}

      <div className="harmony__actions">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="inspector__action"
            data-testid={`harmony-action-${action.id}`}
            title={action.title}
            disabled={!shown.length}
            onClick={() =>
              action.run(shown, tab === "wheel" ? base : mostVivid(shown), rule)
            }
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
