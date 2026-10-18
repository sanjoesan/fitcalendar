// Small stand-ins for a ride's streams that live in its summary: a simplified track and a short elevation profile.

import type { RidePreviewData } from "./types";

const TRACK_POINTS = 80;
const ELEVATION_POINTS = 48;

export function buildPreview(lat: Float64Array | null, lon: Float64Array | null, altitude: Float64Array | null): RidePreviewData {
  const track: [number, number][] = [];
  if (lat && lon) {
    for (let i = 0; i < lat.length; i++) {
      if (!Number.isNaN(lat[i]!) && !Number.isNaN(lon[i]!)) track.push([lat[i]!, lon[i]!]);
    }
  }
  return { track: simplify(track, TRACK_POINTS), elevation: altitude ? downsample(altitude, ELEVATION_POINTS) : [] };
}

/** Douglas-Peucker with a tolerance raised until at most `max` points remain. */
export function simplify(points: readonly (readonly [number, number])[], max: number): [number, number][] {
  if (points.length <= max) return points.map(([a, b]) => [a, b]);
  let tolerance = 1e-5;
  for (;;) {
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    mark(points, 0, points.length - 1, tolerance * tolerance, keep);
    const result = points.filter((_, i) => keep[i]).map(([a, b]) => [a, b] as [number, number]);
    if (result.length <= max) return result;
    tolerance *= 1.6;
  }
}

function mark(points: readonly (readonly [number, number])[], first: number, last: number, tol2: number, keep: Uint8Array): void {
  const stack: [number, number][] = [[first, last]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstD = tol2;
    for (let i = a + 1; i < b; i++) {
      const d = segmentDistance2(points[i]!, points[a]!, points[b]!);
      if (d > worstD) { worstD = d; worst = i; }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
}

function segmentDistance2([py, px]: readonly [number, number], [ay, ax]: readonly [number, number], [by, bx]: readonly [number, number]): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const ex = ax + t * dx - px;
  const ey = ay + t * dy - py;
  return ex * ex + ey * ey;
}

function downsample(values: Float64Array, count: number): number[] {
  const finite = Array.from(values).filter((v) => !Number.isNaN(v));
  if (finite.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(finite[Math.round((i / (count - 1)) * (finite.length - 1))]!);
  return out;
}
