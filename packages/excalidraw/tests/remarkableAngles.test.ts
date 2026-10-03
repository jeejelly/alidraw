import {
  ANGLE_KEYS,
  lockAngle,
  magnetAngle,
  normalizeAngle,
  resolveAngle,
  stepAngle,
  toDegrees,
} from "../remarkableAngles";

const deg = (degrees: number) => (degrees * Math.PI) / 180;

describe("remarkable angles", () => {
  it("number keys name the angles people reach for", () => {
    expect(ANGLE_KEYS["9"]).toBe(90);
    expect(ANGLE_KEYS["4"]).toBe(45);
    expect(ANGLE_KEYS["3"]).toBe(30);
    expect(ANGLE_KEYS["6"]).toBe(60);
    expect(ANGLE_KEYS["2"]).toBe(120);
    expect(ANGLE_KEYS["1"]).toBe(15);
    expect(ANGLE_KEYS["0"]).toBe(0);
  });

  it("the magnet pulls close angles onto 0/30/45/60/90/120/135/150", () => {
    for (const degrees of [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 270]) {
      const result = magnetAngle(deg(degrees + 2));
      expect(result.snapped).toBe(true);
      expect(toDegrees(result.angle)).toBe(degrees % 360);
    }
    expect(magnetAngle(deg(37)).snapped).toBe(false);
    // 15 is a Shift step, not a magnet
    expect(magnetAngle(deg(16)).snapped).toBe(false);
  });

  it("Shift steps by 15 degrees", () => {
    expect(toDegrees(stepAngle(deg(37)))).toBe(30);
    expect(toDegrees(stepAngle(deg(38)))).toBe(45);
  });

  it("a held key locks onto the nearest side of its angle", () => {
    // 60 for a line: 60 or 240
    expect(toDegrees(lockAngle("6", deg(70)!)!)).toBe(60);
    expect(toDegrees(lockAngle("6", deg(200))!)).toBe(240);
    // a rectangle's own axes repeat every quarter turn
    expect(toDegrees(lockAngle("4", deg(100), Math.PI / 2)!)).toBe(135);
    expect(lockAngle("x", 1)).toBeNull();
  });

  it("one rule: key beats Shift beats magnet; Alt is free", () => {
    const base = { key: null, shift: false, alt: false, symmetry: Math.PI * 2 };
    expect(resolveAngle(deg(32), base).how).toBe("magnet");
    expect(toDegrees(resolveAngle(deg(32), base).angle)).toBe(30);
    expect(resolveAngle(deg(32), { ...base, alt: true }).how).toBe("free");
    expect(resolveAngle(deg(32), { ...base, shift: true }).how).toBe("step");
    expect(
      toDegrees(
        resolveAngle(deg(32), { ...base, shift: true, key: "9" }).angle,
      ),
    ).toBe(90);
    expect(resolveAngle(deg(32), { ...base, key: "9" }).how).toBe("key");
    expect(toDegrees(normalizeAngle(-Math.PI / 2))).toBe(270);
  });
});
