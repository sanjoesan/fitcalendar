import { describe, expect, it } from "vitest";
import { decodeFit, FitError } from "../../src/fit/FitDecoder";
import { readActivity } from "../../src/fit/readActivity";
import { FitBuilder, fitSeconds } from "./FitBuilder";

const RECORD_FIELDS = [
  { num: 253, size: 4, type: 0x86 }, // timestamp
  { num: 0, size: 4, type: 0x85 }, // lat
  { num: 1, size: 4, type: 0x85 }, // lon
  { num: 2, size: 2, type: 0x84 }, // altitude
  { num: 5, size: 4, type: 0x86 }, // distance
  { num: 6, size: 2, type: 0x84 }, // speed
  { num: 3, size: 1, type: 0x02 }, // heart rate
];
const SIZES = RECORD_FIELDS.map((f) => f.size);
const semi = (deg: number) => Math.round((deg * 2 ** 31) / 180);
const T0 = fitSeconds("2026-10-17T08:00:00Z");

function ride(opts: { bigEndian?: boolean } = {}): FitBuilder {
  const b = new FitBuilder()
    .define(0, 0, [{ num: 0, size: 1, type: 0x00 }, { num: 4, size: 4, type: 0x86 }])
    .data(0, [4, T0], [1, 4])
    .define(1, 20, RECORD_FIELDS, opts);
  for (let i = 0; i < 5; i++) {
    b.data(1, [T0 + i, semi(43.3 + i * 0.0001), semi(11.3), (100 + i + 500) * 5, i * 500, 5000, i === 2 ? 0xff : 120 + i], SIZES);
  }
  return b;
}

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (e) {
    return e instanceof FitError ? e.code : "other";
  }
  return undefined;
}

describe("decodeFit", () => {
  it("reads records with scale, offset and semicircles", () => {
    const parsed = readActivity(decodeFit(ride().build()));
    expect(parsed.samples.timestamp).toHaveLength(5);
    expect(parsed.samples.lat[1]).toBeCloseTo(43.3001, 6);
    expect(parsed.samples.altitude[3]).toBeCloseTo(103, 6);
    expect(parsed.samples.distance[4]).toBeCloseTo(20, 6);
    expect(parsed.samples.speed[0]).toBeCloseTo(5, 6);
    expect(parsed.samples.heartRate[2]).toBeUndefined(); // 0xFF is "no value"
    expect(parsed.samples.heartRate[3]).toBe(123);
  });

  it("reads big-endian definitions the same way", () => {
    const parsed = readActivity(decodeFit(ride({ bigEndian: true }).build()));
    expect(parsed.samples.altitude[3]).toBeCloseTo(103, 6);
    expect(parsed.samples.timestamp[4]! - parsed.samples.timestamp[0]!).toBe(4000);
  });

  it("accepts a 12-byte header without header CRC", () => {
    expect(decodeFit(ride().build({ headerSize: 12 })).length).toBe(6);
  });

  it("rejects a wrong file CRC", () => {
    expect(codeOf(() => decodeFit(ride().build({ corruptCrc: true })))).toBe("crc");
  });

  it("rejects something that is not FIT", () => {
    expect(codeOf(() => decodeFit(new TextEncoder().encode("hello world, this is not a fit file")))).toBe("not_fit");
  });

  it("rejects a truncated file", () => {
    expect(codeOf(() => decodeFit(ride().build().subarray(0, 60)))).toBe("truncated");
  });

  it("expands compressed timestamps, also across the 32-second wrap", () => {
    const base = T0 - (T0 % 32) + 30; // low bits 30
    const b = new FitBuilder()
      .define(0, 20, [{ num: 253, size: 4, type: 0x86 }, { num: 3, size: 1, type: 0x02 }])
      .data(0, [base, 100], [4, 1])
      .define(1, 20, [{ num: 3, size: 1, type: 0x02 }])
      .compressed(1, 31, [101], [1])
      .compressed(1, 2, [102], [1]); // wraps: 30 → 31 → 34
    const parsed = readActivity(decodeFit(b.build()));
    const ts = parsed.samples.timestamp.map((t) => (t - parsed.samples.timestamp[0]!) / 1000);
    expect(ts).toEqual([0, 1, 4]);
  });

  it("skips developer fields and survives a redefined local type", () => {
    const b = new FitBuilder()
      .define(0, 20, [{ num: 253, size: 4, type: 0x86 }, { num: 7, size: 2, type: 0x84 }], { developerSizes: [3, 1] })
      .data(0, [T0, 250], [4, 2], 4)
      .define(0, 20, [{ num: 253, size: 4, type: 0x86 }, { num: 7, size: 2, type: 0x84 }])
      .data(0, [T0 + 1, 260], [4, 2]);
    const parsed = readActivity(decodeFit(b.build()));
    expect(parsed.samples.power).toEqual([250, 260]);
  });

  it("refuses a non-activity file", () => {
    const b = new FitBuilder().define(0, 0, [{ num: 0, size: 1, type: 0x00 }]).data(0, [6], [1]);
    expect(codeOf(() => readActivity(decodeFit(b.build())))).toBe("not_activity");
  });

  it("names the ride from the session's sport_profile_name", () => {
    const b = ride()
      .define(2, 18, [
        { num: 253, size: 4, type: 0x86 },
        { num: 5, size: 1, type: 0x00 },
        { num: 6, size: 1, type: 0x00 },
        { num: 110, size: 16, type: 0x07 },
      ])
      .data(2, [T0 + 5, 2, 58, "Giro della Porta"], [4, 1, 1, 16]);
    const parsed = readActivity(decodeFit(b.build()));
    expect(parsed.title).toBe("Giro della Porta");
    expect(parsed.sport).toBe("ride");
    expect(parsed.indoor).toBe(true);
  });
});
