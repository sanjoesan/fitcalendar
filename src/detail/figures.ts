// Every number the detail page shows for a stretch of the ride - the whole ride or the view/drag - computed once
// per change and read by the tiles, the statistics groups and the zone bars.

import { athleteForRide, type AthleteProfile, type RideAthlete } from "../model/athlete";
import { rideLoad } from "../model/load";
import { perSecond, powerFigures, trainingLoad, type TrainingLoad } from "../model/power";
import { segmentStats } from "../model/segment";
import type { ActivityStreams, ActivitySummary, ChannelStatsMap, DeviceMetrics, PowerFigures, SampleRange } from "../model/types";

export interface Figures {
  /** The whole ride (device totals apply) or a stretch of it. */
  readonly whole: boolean;
  readonly range: SampleRange;
  readonly distance: number;
  readonly movingTime: number;
  readonly elapsedTime: number;
  readonly ascent: number;
  readonly descent: number;
  readonly channels: ChannelStatsMap;
  readonly power: PowerFigures | null;
  readonly load: TrainingLoad | null;
  readonly athlete: RideAthlete;
  /** Only for the whole ride: what the device computed (TE, its own NP/TSS, pedal metrics, calories). */
  readonly device: DeviceMetrics;
  readonly calories: number | null;
  /** End height minus start height over the distance. */
  readonly netGradient: number | null;
}

export function computeFigures(summary: ActivitySummary, streams: ActivityStreams, range: SampleRange, profile: AthleteProfile): Figures {
  const athlete = athleteForRide(profile, summary);
  const whole = range.from === 0 && range.to === streams.time.length - 1;
  const altitude = streams.channels.altitude;
  if (whole) {
    return {
      whole, range, athlete,
      distance: summary.distance,
      movingTime: summary.movingTime,
      elapsedTime: summary.elapsedTime,
      ascent: summary.ascent,
      descent: summary.descent,
      channels: summary.channels,
      power: summary.power,
      load: rideLoad(summary, athlete),
      device: summary.device,
      calories: summary.calories,
      netGradient: netGradient(altitude, streams.distance, range),
    };
  }
  const stats = segmentStats(streams, range);
  const power = streams.channels.power ? powerFigures(perSecond(streams.time, streams.channels.power, range)) : null;
  const ftp = athlete.values.ftp;
  return {
    whole, range, athlete,
    distance: stats.distance,
    movingTime: stats.movingTime,
    elapsedTime: stats.elapsedTime,
    ascent: stats.ascent,
    descent: stats.descent,
    channels: stats.channels,
    power,
    load: ftp && power?.normalized ? trainingLoad(power.normalized, ftp, stats.movingTime) : null,
    device: {},
    calories: null,
    netGradient: netGradient(altitude, streams.distance, range),
  };
}

function netGradient(altitude: Float64Array | undefined, distance: Float64Array | null, { from, to }: SampleRange): number | null {
  if (!altitude || !distance) return null;
  const run = distance[to]! - distance[from]!;
  const rise = altitude[to]! - altitude[from]!;
  return run > 100 && !Number.isNaN(rise) ? rise / run : null;
}
