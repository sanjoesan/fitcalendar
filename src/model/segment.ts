// The numbers of a stretch of a ride: distance, times, climb and each channel's mean and maximum.
// Used for the whole ride, for laps and for the range selected on the profiles.

import { climb } from "./climb";
import type { ActivityStreams, ChannelKey, ChannelStatsMap, SampleRange } from "./types";

/** A gap between samples longer than this is a pause (timer stopped), not riding. */
const PAUSE_GAP_S = 30;
/** Slower than this counts as standing. */
const MOVING_SPEED_MS = 0.3;

export interface SegmentStats {
  readonly distance: number;
  readonly elapsedTime: number;
  readonly movingTime: number;
  readonly ascent: number;
  readonly descent: number;
  readonly channels: ChannelStatsMap;
}

export function segmentStats(streams: ActivityStreams, range: SampleRange): SegmentStats {
  const { time, distance } = streams;
  const { from, to } = range;
  const moving = movingWeights(streams, range);
  let movingTime = 0;
  for (let i = from; i <= to; i++) movingTime += moving[i - from]!;

  const altitude = streams.channels.altitude;
  const { ascent, descent } = altitude ? climb(altitude, from, to) : { ascent: 0, descent: 0 };

  const channels: ChannelStatsMap = {};
  for (const key of Object.keys(streams.channels) as ChannelKey[]) {
    const values = streams.channels[key]!;
    const stats = weightedStats(values, moving, range);
    if (stats) channels[key] = stats;
  }
  // Mean speed is distance over moving time, as every bike computer shows it.
  if (channels.speed && distance && movingTime > 0) {
    channels.speed = { ...channels.speed, mean: (distance[to]! - distance[from]!) / movingTime };
  }
  return {
    distance: distance ? distance[to]! - distance[from]! : 0,
    elapsedTime: time[to]! - time[from]!,
    movingTime,
    ascent,
    descent,
    channels,
  };
}

/** Seconds each sample stands for while moving (0 while paused or standing), index relative to range.from. */
export function movingWeights(streams: ActivityStreams, { from, to }: SampleRange): Float64Array {
  const { time, distance } = streams;
  const speed = streams.channels.speed;
  const weights = new Float64Array(to - from + 1);
  for (let i = from + 1; i <= to; i++) {
    const dt = time[i]! - time[i - 1]!;
    if (dt <= 0 || dt > PAUSE_GAP_S) continue;
    const v = speed && !Number.isNaN(speed[i]!) ? speed[i]! : distance ? (distance[i]! - distance[i - 1]!) / dt : MOVING_SPEED_MS;
    if (v >= MOVING_SPEED_MS) weights[i - from] = dt;
  }
  return weights;
}

function weightedStats(values: Float64Array, weights: Float64Array, { from, to }: SampleRange) {
  let sum = 0;
  let weight = 0;
  let max = Number.NEGATIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  for (let i = from; i <= to; i++) {
    const v = values[i]!;
    if (Number.isNaN(v)) continue;
    if (v > max) max = v;
    if (v < min) min = v;
    const w = weights[i - from]!;
    sum += v * w;
    weight += w;
  }
  if (max === Number.NEGATIVE_INFINITY) return null;
  return { mean: weight > 0 ? sum / weight : max, min, max };
}
