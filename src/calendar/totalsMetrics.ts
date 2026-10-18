// How each totals figure is labelled and written - drives the week column, the month band and the bar switch.

import type { TextKey } from "../i18n/de";
import type { Formatter } from "../i18n/format";
import type { Totals, TotalsMetric } from "../model/totals";

export interface TotalsMetricDef {
  readonly key: TotalsMetric;
  readonly labelKey: TextKey;
  readonly shortKey: TextKey;
  readonly value: (t: Totals) => number;
  readonly format: (fmt: Formatter, value: number) => string;
}

export const TOTALS_METRIC_DEFS: readonly TotalsMetricDef[] = [
  { key: "distance", labelKey: "totals.distance", shortKey: "unit.km", value: (t) => t.distance, format: (f, v) => f.distance(v) },
  { key: "movingTime", labelKey: "totals.movingTime", shortKey: "totals.hours", value: (t) => t.movingTime, format: (f, v) => f.durationShort(v) },
  { key: "ascent", labelKey: "totals.ascent", shortKey: "totals.hm", value: (t) => t.ascent, format: (f, v) => f.ascent(v) },
  { key: "stress", labelKey: "totals.stress", shortKey: "totals.tss", value: (t) => t.stress, format: (f, v) => `${f.number(v)} TSS` },
];

export function totalsMetric(key: TotalsMetric): TotalsMetricDef {
  return TOTALS_METRIC_DEFS.find((d) => d.key === key)!;
}
