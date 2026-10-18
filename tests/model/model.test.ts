import { describe, expect, it } from "vitest";
import { buildMonth } from "../../src/calendar/MonthModel";
import { addMonths, isoWeek, localDay, weeksOfMonth } from "../../src/model/calendar";
import { climb } from "../../src/model/climb";
import { segmentStats } from "../../src/model/segment";
import { titleFromFileName } from "../../src/model/title";
import type { ActivityStreams, ActivitySummary } from "../../src/model/types";

describe("climb", () => {
  it("ignores noise below 1 m and sums real climbs", () => {
    const alt = Float64Array.from([100, 100.4, 99.8, 100.3, 101.5, 103, 102.5, 104, 100]);
    expect(climb(alt, 0, alt.length - 1)).toEqual({ ascent: 4, descent: 4 });
  });
});

describe("segmentStats", () => {
  const n = 101;
  const streams: ActivityStreams = {
    id: "t",
    time: Float64Array.from({ length: n }, (_, i) => i),
    distance: Float64Array.from({ length: n }, (_, i) => i * 10),
    lat: null,
    lon: null,
    channels: {
      speed: new Float64Array(n).fill(10),
      heartRate: Float64Array.from({ length: n }, (_, i) => (i < 50 ? 100 : 150)),
    },
    laps: [],
  };
  it("gives distance, times and time-weighted means", () => {
    const s = segmentStats(streams, { from: 0, to: 100 });
    expect(s.distance).toBe(1000);
    expect(s.movingTime).toBe(100);
    expect(s.channels.speed!.mean).toBeCloseTo(10);
    expect(s.channels.heartRate!.max).toBe(150);
    expect(s.channels.heartRate!.mean).toBeCloseTo(125.5, 0);
  });
  it("works on a part of the ride", () => {
    expect(segmentStats(streams, { from: 60, to: 80 }).channels.heartRate!.mean).toBe(150);
  });
});

describe("calendar", () => {
  it("numbers ISO weeks across the turn of the year", () => {
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2026-10-18")).toBe(42);
  });
  it("starts weeks on Monday and covers the whole month", () => {
    const weeks = weeksOfMonth({ year: 2026, month: 2 });
    expect(weeks[0]).toBe("2026-01-26");
    expect(weeks.at(-1)).toBe("2026-02-23");
    expect(weeksOfMonth({ year: 2026, month: 3 })).toHaveLength(6);
  });
  it("puts a ride on its local day", () => {
    expect(localDay(Date.UTC(2026, 9, 17, 23, 30), 120)).toBe("2026-10-18");
    expect(localDay(Date.UTC(2026, 9, 17, 23, 30), 0)).toBe("2026-10-17");
  });
  it("adds months over the year", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("buildMonth", () => {
  const ride = (id: string, day: string, km: number) =>
    ({ id, day, distance: km * 1000, movingTime: 3600, ascent: 100 }) as unknown as ActivitySummary;
  it("week totals cover the whole week, month totals only the month", () => {
    const rides = new Map([
      ["2026-09-30", [ride("a", "2026-09-30", 30)]],
      ["2026-10-02", [ride("b", "2026-10-02", 50)]],
    ]);
    const m = buildMonth({ year: 2026, month: 10 }, rides, () => null, "2026-10-18");
    expect(m.weeks[0]!.totals.distance).toBe(80_000);
    expect(m.totals.distance).toBe(50_000);
    expect(m.weeks.flatMap((w) => w.days).find((d) => d.isToday)?.key).toBe("2026-10-18");
  });
});

describe("titleFromFileName", () => {
  it("cleans dates and separators", () => {
    expect(titleFromFileName("2026-06-10_19-48_Giro di Castellina II.fit")).toBe("Giro di Castellina II");
    expect(titleFromFileName("giro_giro-della-porta_20261004_194450.fit")).toBe("Giro giro della porta");
    expect(titleFromFileName("ride_20261004_194437.fit")).toBeNull();
    expect(titleFromFileName("Anello Vignaverde - San Vito.fit")).toBe("Anello Vignaverde - San Vito");
  });
});
