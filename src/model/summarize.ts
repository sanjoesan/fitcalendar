// Builds the app's Activity (summary + streams) from a parsed FIT file.

import type { Column, ParsedActivity } from "../fit/readActivity";
import { localDay } from "./calendar";
import { channelDef } from "./channels";
import { haversine } from "./geo";
import { gradient } from "./gradient";
import { perSecond, powerFigures } from "./power";
import { buildPreview } from "./preview";
import { segmentStats } from "./segment";
import { titleFromFileName } from "./title";
import type { Activity, ActivityStreams, ChannelKey, SampleRange } from "./types";

/** Raise when the way summaries or streams are built changes: stored rides are then rebuilt from their files. */
export const PARSER_VERSION = 1;

export interface ImportMeta {
  readonly id: string;
  readonly fileName: string;
  readonly importedAt: number;
}

export function summarize(parsed: ParsedActivity, meta: ImportMeta): Activity {
  const { samples } = parsed;
  const t0 = samples.timestamp[0]!;
  const time = Float64Array.from(samples.timestamp, (t) => (t - t0) / 1000);
  const track = trackOf(samples.lat, samples.lon);
  const distance = distanceOf(samples.distance, track, samples.speed, time);

  const channels: Partial<Record<ChannelKey, Float64Array>> = {};
  /** A channel enters the ride only when its sensor delivered something: all zeros is a sensor never connected. */
  const put = (key: ChannelKey, column: Column) => {
    const values = toArray(column);
    if (!values) return;
    if (channelDef(key).zeroIsMissing) values.forEach((v, i) => { if (v === 0) values[i] = Number.NaN; });
    if (values.some((v) => !Number.isNaN(v) && v !== 0)) channels[key] = values;
  };
  put("altitude", samples.altitude);
  put("speed", samples.speed);
  if (!channels.speed && distance) channels.speed = speedFrom(distance, time);
  put("heartRate", samples.heartRate);
  put("power", samples.power);
  put("cadence", samples.cadence);
  if (distance && channels.altitude) channels.gradient = gradient(distance, channels.altitude);
  put("temperature", samples.temperature);
  put("balance", samples.balance);

  const streams: ActivityStreams = {
    id: meta.id,
    time,
    distance,
    lat: track?.lat ?? null,
    lon: track?.lon ?? null,
    channels,
    laps: lapRanges(parsed.laps, samples.timestamp),
  };
  const whole = segmentStats(streams, { from: 0, to: time.length - 1 });
  const totals = parsed.totals;
  const tzOffsetMin = parsed.tzOffsetMin ?? -new Date(t0).getTimezoneOffset();
  return {
    streams,
    summary: {
      id: meta.id,
      fileKey: parsed.fileKey,
      title: parsed.title ?? titleFromFileName(meta.fileName),
      fileName: meta.fileName,
      sport: parsed.sport,
      indoor: parsed.indoor,
      deviceName: parsed.deviceName,
      start: t0,
      tzOffsetMin,
      day: localDay(t0, tzOffsetMin),
      // The device's own totals win where it wrote them: they are what the rider saw on the bike.
      distance: totals.distance ?? whole.distance,
      movingTime: totals.movingTime ?? whole.movingTime,
      elapsedTime: totals.elapsedTime ?? whole.elapsedTime,
      ascent: totals.ascent ?? whole.ascent,
      descent: totals.descent ?? whole.descent,
      calories: totals.calories ?? null,
      channels: whole.channels,
      power: channels.power ? powerFigures(perSecond(time, channels.power)) : null,
      device: parsed.deviceMetrics,
      fileAthlete: parsed.athlete,
      lapCount: streams.laps.length,
      preview: buildPreview(streams.lat, streams.lon, channels.altitude ?? null),
      importedAt: meta.importedAt,
      parserVersion: PARSER_VERSION,
    },
  };
}

function toArray(column: Column): Float64Array | null {
  let any = false;
  const out = new Float64Array(column.length);
  for (let i = 0; i < column.length; i++) {
    const v = column[i];
    if (v === undefined) out[i] = Number.NaN;
    else { out[i] = v; any = true; }
  }
  return any ? out : null;
}

function trackOf(latColumn: Column, lonColumn: Column) {
  const lat = toArray(latColumn);
  const lon = toArray(lonColumn);
  if (!lat || !lon) return null;
  let count = 0;
  for (let i = 0; i < lat.length; i++) {
    // A position at exactly 0/0 is a device without a fix, not a ride in the Gulf of Guinea.
    if (lat[i] === 0 && lon[i] === 0) lat[i] = lon[i] = Number.NaN;
    if (!Number.isNaN(lat[i]!) && !Number.isNaN(lon[i]!)) count++;
  }
  return count >= 2 ? { lat, lon } : null;
}

/** Recorded distance, else summed from the track, else integrated speed; forward-filled, starting at 0. */
function distanceOf(recorded: Column, track: { lat: Float64Array; lon: Float64Array } | null, speed: Column, time: Float64Array): Float64Array | null {
  const n = time.length;
  const filled = recorded.filter((v) => v !== undefined).length;
  if (filled >= n / 2) {
    const out = new Float64Array(n);
    let last = recorded.find((v) => v !== undefined) ?? 0;
    const origin = last;
    for (let i = 0; i < n; i++) {
      const v = recorded[i];
      if (v !== undefined && v >= last) last = v;
      out[i] = last - origin;
    }
    return out;
  }
  if (track) {
    const out = new Float64Array(n);
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const ok = !Number.isNaN(track.lat[i]!);
      out[i] = i === 0 ? 0 : out[i - 1]!;
      if (ok) {
        if (prev >= 0) out[i] = out[i]! + haversine(track.lat[prev]!, track.lon[prev]!, track.lat[i]!, track.lon[i]!);
        prev = i;
      }
    }
    return out;
  }
  if (speed.some((v) => v !== undefined)) {
    const out = new Float64Array(n);
    for (let i = 1; i < n; i++) out[i] = out[i - 1]! + (speed[i] ?? 0) * Math.min(time[i]! - time[i - 1]!, 30);
    return out;
  }
  return null;
}

/** Speed from distance over a ±2 sample window. */
function speedFrom(distance: Float64Array, time: Float64Array): Float64Array {
  const n = distance.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2);
    const b = Math.min(n - 1, i + 2);
    const dt = time[b]! - time[a]!;
    out[i] = dt > 0 ? (distance[b]! - distance[a]!) / dt : 0;
  }
  return out;
}

function lapRanges(laps: ParsedActivity["laps"], timestamps: readonly number[]): SampleRange[] {
  if (laps.length < 2) return [];
  const indexAt = (t: number) => {
    let lo = 0;
    let hi = timestamps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (timestamps[mid]! < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return laps
    .map(([start, end]) => ({ from: indexAt(start), to: Math.max(indexAt(start), Math.min(indexAt(end), timestamps.length - 1)) }))
    .filter((r) => r.to > r.from);
}
