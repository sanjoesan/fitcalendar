import { describe, expect, it } from "vitest";
import type { Figures } from "../../src/detail/figures";
import { STAT, statValue } from "../../src/detail/statDefs";

const figures = (channels: Figures["channels"]): Figures => ({
  whole: true, range: { from: 0, to: 1 }, distance: 1000, movingTime: 100, elapsedTime: 100, ascent: 0, descent: 0, channels,
  power: null, load: null, device: {}, calories: null, netGradient: null,
  athlete: { values: { ftp: 210, weight: 75, maxHr: 185 }, sources: { ftp: "profile", weight: "profile", maxHr: "file" } },
});

describe("statValue", () => {
  it("hides rider settings on a ride without the measurement they belong to", () => {
    const noMeters = figures({ speed: { mean: 8, min: 0, max: 12 } });
    expect(statValue(STAT.ftp, noMeters)).toBeNull();
    expect(statValue(STAT.powerPerKilo, noMeters)).toBeNull();
    expect(statValue(STAT.heartPctMax, noMeters)).toBeNull();
    expect(statValue(STAT.movingSpeed, noMeters)).toBe(8);
  });
  it("shows them when the ride has the measurement", () => {
    const withPower = figures({ power: { mean: 150, min: 0, max: 400 } });
    expect(statValue(STAT.ftp, withPower)).toBe(210);
    expect(statValue(STAT.powerPerKilo, withPower)).toBe(2);
  });
});
