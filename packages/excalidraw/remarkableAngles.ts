import { EVENT } from "@excalidraw/common";

/**
 * Angles people actually want: 15° steps, and the special ones among them.
 * Number keys lock a gesture onto one of them while held:
 *
 *   0 → 0°   1 → 15°   2 → 120°   3 → 30°   4 → 45°
 *   5 → 135° 6 → 60°   7 → 75°    8 → 150°  9 → 90°
 */
export const ANGLE_KEYS: Readonly<Record<string, number>> = {
  "0": 0,
  "1": 15,
  "2": 120,
  "3": 30,
  "4": 45,
  "5": 135,
  "6": 60,
  "7": 75,
  "8": 150,
  "9": 90,
};

/** the keys worth showing in the helper, with their angle */
export const ANGLE_HELPER_KEYS: readonly (readonly [string, number])[] = [
  ["0", 0],
  ["1", 15],
  ["3", 30],
  ["4", 45],
  ["6", 60],
  ["9", 90],
  ["2", 120],
];

const rad = (deg: number) => (deg * Math.PI) / 180;
const TWO_PI = Math.PI * 2;

/** the magnet: 0, 30, 45, 60, 90, 120, 135, 150 and their opposites */
export const MAGNET_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150].flatMap(
  (degrees) => [degrees, degrees + 180],
);
export const MAGNET_TOLERANCE = rad(2.5);

export const normalizeAngle = (angle: number) =>
  ((angle % TWO_PI) + TWO_PI) % TWO_PI;

/** the signed shortest turn from `from` to `to` */
const delta = (from: number, to: number) => {
  const difference = normalizeAngle(to - from);
  return difference > Math.PI ? difference - TWO_PI : difference;
};

/**
 * Pulls an angle (radians) onto the nearest magnet angle when it is within
 * tolerance. @returns the angle and whether it snapped.
 */
export const magnetAngle = (
  angle: number,
  { symmetry = TWO_PI, tolerance = MAGNET_TOLERANCE } = {},
): { angle: number; snapped: boolean } => {
  let best = angle;
  let bestD = tolerance + 1e-12;
  for (const deg of MAGNET_ANGLES) {
    // symmetry: 2π for a direction, π/2 for a rectangle's own axes
    const base = rad(deg);
    const turns = Math.round((angle - base) / symmetry);
    const target = base + turns * symmetry;
    const separation = Math.abs(target - angle);
    if (separation < bestD) {
      best = target;
      bestD = separation;
    }
  }
  return { angle: best, snapped: bestD <= tolerance };
};

/** the angle in 15° steps (Shift) */
export const stepAngle = (angle: number, stepDeg = 15) =>
  Math.round(angle / rad(stepDeg)) * rad(stepDeg);

/**
 * The angle a held key asks for, on the side nearest to `current`: a
 * direction has two sides (a, a + 180°), a rectangle's axes four.
 */
export const lockAngle = (
  key: string,
  current: number,
  symmetry = Math.PI,
): number | null => {
  const deg = ANGLE_KEYS[key];
  if (deg === undefined) {
    return null;
  }
  const base = rad(deg);
  const turns = Math.round((current - base) / symmetry);
  return base + turns * symmetry;
};

/**
 * Tracks which angle key is held while a gesture runs. Typing in a field is
 * left alone.
 */
export class AngleKeys {
  private held: string | null = null;
  private stop: (() => void) | null = null;

  start = (win: Window, onChange?: () => void) => {
    this.end();
    const down = (keyEvent: KeyboardEvent) => {
      if (
        keyEvent.key in ANGLE_KEYS &&
        !keyEvent.ctrlKey &&
        !keyEvent.metaKey &&
        !keyEvent.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (keyEvent.target as HTMLElement | null)?.tagName ?? "",
        )
      ) {
        this.held = keyEvent.key;
        onChange?.();
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
      }
    };
    const up = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === this.held) {
        this.held = null;
        onChange?.();
      }
    };
    win.addEventListener(EVENT.KEYDOWN, down, true);
    win.addEventListener(EVENT.KEYUP, up, true);
    this.stop = () => {
      win.removeEventListener(EVENT.KEYDOWN, down, true);
      win.removeEventListener(EVENT.KEYUP, up, true);
    };
  };

  /** the key held right now, and its angle in degrees */
  get key() {
    return this.held;
  }
  get degrees() {
    return this.held ? ANGLE_KEYS[this.held] : null;
  }

  end = () => {
    this.stop?.();
    this.stop = null;
    this.held = null;
  };
}

/**
 * One rule for every angle gesture: a held key locks, Shift steps by 15°,
 * Alt is free, otherwise the magnet helps. `symmetry` is π for a line,
 * 2π for a direction, π/2 for a rectangle's own axes.
 */
export const resolveAngle = (
  raw: number,
  {
    key,
    shift,
    alt,
    symmetry,
  }: { key: string | null; shift: boolean; alt: boolean; symmetry: number },
): { angle: number; how: "key" | "step" | "magnet" | "free" } => {
  if (key) {
    const locked = lockAngle(key, raw, symmetry);
    if (locked !== null) {
      return { angle: locked, how: "key" };
    }
  }
  if (shift) {
    return { angle: stepAngle(raw), how: "step" };
  }
  if (!alt) {
    const magnet = magnetAngle(raw, { symmetry });
    if (magnet.snapped) {
      return { angle: magnet.angle, how: "magnet" };
    }
  }
  return { angle: raw, how: "free" };
};

export const toDegrees = (angle: number) =>
  Math.round(((normalizeAngle(angle) * 180) / Math.PI) * 10) / 10;

export { delta as angleDelta };
