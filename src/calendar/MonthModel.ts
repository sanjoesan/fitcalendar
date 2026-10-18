// The month as data: its weeks (Monday to Sunday), each day's rides and the totals - drawn by the grid and the agenda.

import { addDays, isoWeek, monthOf, today, weeksOfMonth, type YearMonth } from "../model/calendar";
import { aggregate, type Totals } from "../model/totals";
import type { ActivitySummary } from "../model/types";

export interface DayModel {
  readonly key: string;
  readonly dayOfMonth: number;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  /** Sorted by start. */
  readonly rides: readonly ActivitySummary[];
}

export interface WeekModel {
  readonly monday: string;
  readonly isoWeek: number;
  readonly days: readonly DayModel[];
  /** The whole Monday-to-Sunday week, also the days of the neighbouring month. */
  readonly totals: Totals;
}

export interface MonthModel {
  readonly month: YearMonth;
  readonly weeks: readonly WeekModel[];
  /** Only the days of this month. */
  readonly totals: Totals;
  readonly longest: ActivitySummary | null;
}

export type StressOf = (ride: ActivitySummary) => number | null;

/** `ridesByDay` holds every ride of the visible days; `todayKey` is passed so the model stays a pure function. */
export function buildMonth(
  month: YearMonth,
  ridesByDay: ReadonlyMap<string, readonly ActivitySummary[]>,
  stressOf: StressOf = () => null,
  todayKey = today(),
): MonthModel {
  const weeks = weeksOfMonth(month).map((monday): WeekModel => {
    const days = Array.from({ length: 7 }, (_, i): DayModel => {
      const key = addDays(monday, i);
      const m = monthOf(key);
      return {
        key,
        dayOfMonth: Number(key.slice(8)),
        inMonth: m.year === month.year && m.month === month.month,
        isToday: key === todayKey,
        rides: ridesByDay.get(key) ?? [],
      };
    });
    return { monday, isoWeek: isoWeek(monday), days, totals: aggregate(days.flatMap((d) => d.rides), stressOf) };
  });
  const inMonth = weeks.flatMap((w) => w.days).filter((d) => d.inMonth).flatMap((d) => d.rides);
  const longest = inMonth.reduce<ActivitySummary | null>((best, r) => (!best || r.distance > best.distance ? r : best), null);
  return { month, weeks, totals: aggregate(inMonth, stressOf), longest };
}
