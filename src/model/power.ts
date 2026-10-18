// Power analysis as bike computers and training apps show it: best efforts, Normalized Power, IF, TSS, work.

import type { PowerFigures, SampleRange } from "./types";

/** The durations of the best-efforts table (seconds). */
export const BEST_EFFORT_DURATIONS: readonly number[] = [5, 60, 300, 600, 1200, 3600];

/** The durations of the power curve, roughly log-spaced (seconds). */
export const CURVE_DURATIONS: readonly number[] = [
  1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200, 10800, 14400,
];

/** A gap longer than this between samples is a pause and adds no time. */
const PAUSE_GAP_S = 30;

/** A channel on a 1-second grid (each second takes the latest sample), pauses removed. */
export interface SecondSeries {
  readonly values: Float64Array;
  /** The sample each second came from - to find a best effort on the ride again. */
  readonly sampleAt: Int32Array;
}

export function perSecond(time: Float64Array, values: Float64Array, range: SampleRange = { from: 0, to: time.length - 1 }): SecondSeries {
  const out: number[] = [];
  const at: number[] = [];
  for (let i = range.from; i < range.to; i++) {
    const dt = time[i + 1]! - time[i]!;
    if (dt <= 0) continue;
    const seconds = dt > PAUSE_GAP_S ? 1 : Math.round(dt);
    const v = values[i]!;
    for (let s = 0; s < seconds; s++) {
      out.push(Number.isNaN(v) ? 0 : v);
      at.push(i);
    }
  }
  return { values: Float64Array.from(out), sampleAt: Int32Array.from(at) };
}

export interface BestEffort {
  readonly duration: number;
  readonly watts: number;
  /** Where it was ridden, as samples. */
  readonly range: SampleRange;
}

/** The highest mean over any window of `duration` seconds; null when the series is shorter. */
export function bestEffort(series: SecondSeries, duration: number): BestEffort | null {
  const v = series.values;
  if (v.length < duration || duration <= 0) return null;
  let sum = 0;
  for (let i = 0; i < duration; i++) sum += v[i]!;
  let best = sum;
  let bestStart = 0;
  for (let i = duration; i < v.length; i++) {
    sum += v[i]! - v[i - duration]!;
    if (sum > best) { best = sum; bestStart = i - duration + 1; }
  }
  const range = { from: series.sampleAt[bestStart]!, to: series.sampleAt[bestStart + duration - 1]! + 1 };
  return { duration, watts: best / duration, range };
}

export function bestEfforts(series: SecondSeries, durations: readonly number[]): BestEffort[] {
  return durations.flatMap((d) => {
    const e = bestEffort(series, d);
    return e ? [e] : [];
  });
}

/** Normalized Power: the 30-second rolling mean, raised to the 4th power, averaged, 4th root. */
export function normalizedPower(series: SecondSeries): number | null {
  const v = series.values;
  const window = 30;
  if (v.length < window) return null;
  let sum = 0;
  for (let i = 0; i < window; i++) sum += v[i]!;
  let acc = 0;
  let count = 0;
  for (let i = window - 1; i < v.length; i++) {
    if (i >= window) sum += v[i]! - v[i - window]!;
    acc += (sum / window) ** 4;
    count++;
  }
  return (acc / count) ** 0.25;
}

/** NP, work and the best efforts of a stretch - for a whole ride or a selection. */
export function powerFigures(series: SecondSeries): PowerFigures {
  let joules = 0;
  for (const w of series.values) joules += w;
  return {
    normalized: normalizedPower(series),
    work: joules / 1000,
    bestEfforts: bestEfforts(series, BEST_EFFORT_DURATIONS).map(({ duration, watts }) => ({ duration, watts })),
  };
}

export interface TrainingLoad {
  readonly intensity: number;
  readonly stress: number;
}

/** Intensity Factor (NP / FTP) and Training Stress Score for a stretch of `seconds`. */
export function trainingLoad(normalized: number, ftp: number, seconds: number): TrainingLoad {
  const intensity = normalized / ftp;
  return { intensity, stress: ((seconds * normalized * intensity) / (ftp * 3600)) * 100 };
}
