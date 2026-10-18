// Adds rides up - the one rule behind the week column, the month band and the month picker.

import type { ActivitySummary } from "./types";

export interface Totals {
  readonly count: number;
  readonly distance: number;
  readonly movingTime: number;
  readonly ascent: number;
  /** Sum of the rides' TSS; 0 when none has one. */
  readonly stress: number;
}

export const NO_TOTALS: Totals = { count: 0, distance: 0, movingTime: 0, ascent: 0, stress: 0 };

/** `stressOf` gives a ride's TSS (it needs the rider's FTP, which the totals do not know). */
export function aggregate(rides: readonly ActivitySummary[], stressOf: (ride: ActivitySummary) => number | null = () => null): Totals {
  return rides.reduce<Totals>(
    (t, r) => ({
      count: t.count + 1,
      distance: t.distance + r.distance,
      movingTime: t.movingTime + r.movingTime,
      ascent: t.ascent + r.ascent,
      stress: t.stress + (stressOf(r) ?? 0),
    }),
    NO_TOTALS,
  );
}

/** The figures of the totals, by name. */
export type TotalsMetric = "distance" | "movingTime" | "ascent" | "stress";
