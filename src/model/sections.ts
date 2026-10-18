// Stretches of a ride the detail page lists besides the device's laps: distance splits and detected climbs.

import type { ActivityStreams, SampleRange } from "./types";

/** Every `km` kilometres a split; the last one may be shorter. */
export function splits(distance: Float64Array | null, km: number): SampleRange[] {
  if (!distance) return [];
  const step = km * 1000;
  const out: SampleRange[] = [];
  let from = 0;
  let next = step;
  for (let i = 1; i < distance.length; i++) {
    if (distance[i]! >= next) {
      out.push({ from, to: i });
      from = i;
      next += step;
    }
  }
  if (distance.length - 1 > from && distance[distance.length - 1]! - distance[from]! > 50) out.push({ from, to: distance.length - 1 });
  return out;
}

/** A climb: at least this long, this high and this steep on average. */
const CLIMB_MIN_LENGTH_M = 500;
const CLIMB_MIN_GAIN_M = 20;
const CLIMB_MIN_GRADIENT = 0.03;
/** A drop of more than this below the highest point so far ends a climb. */
const CLIMB_END_DROP_M = 10;

export function climbs(streams: ActivityStreams): SampleRange[] {
  const altitude = streams.channels.altitude;
  const distance = streams.distance;
  if (!altitude || !distance) return [];
  const out: SampleRange[] = [];
  let low = -1;
  let peak = -1;
  const close = () => {
    if (low < 0 || peak <= low) return;
    const gain = altitude[peak]! - altitude[low]!;
    const length = distance[peak]! - distance[low]!;
    if (gain >= CLIMB_MIN_GAIN_M && length >= CLIMB_MIN_LENGTH_M && gain / length >= CLIMB_MIN_GRADIENT) out.push({ from: low, to: peak });
  };
  for (let i = 0; i < altitude.length; i++) {
    const a = altitude[i]!;
    if (Number.isNaN(a)) continue;
    if (low < 0 || a < altitude[low]!) {
      // A new lowest point before the climb got going: the climb starts here.
      if (peak > low && low >= 0 && altitude[peak]! - a > CLIMB_END_DROP_M) close();
      low = i;
      peak = i;
    } else if (a > altitude[peak]!) {
      peak = i;
    } else if (altitude[peak]! - a > CLIMB_END_DROP_M) {
      close();
      low = i;
      peak = i;
    }
  }
  close();
  return out;
}
