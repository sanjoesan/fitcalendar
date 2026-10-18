// Colouring the track by a channel: values sorted into bins, each bin a colour on a ramp of three tokens.

import { cssVar } from "../ui/dom";

export const BINS = 24;

export interface Ramp {
  readonly lo: number;
  readonly hi: number;
  readonly colours: readonly string[];
}

/** The 2nd to 98th percentile, so a single spike does not wash out the colours. */
export function rampFor(values: Float64Array): Ramp {
  const finite = Array.from(values).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  const pick = (q: number) => finite[Math.min(finite.length - 1, Math.max(0, Math.round(q * (finite.length - 1))))] ?? 0;
  const stops = ["--ramp-1", "--ramp-2", "--ramp-3"].map((t) => hex(cssVar(t)));
  const colours = Array.from({ length: BINS }, (_, b) => mix(stops, b / (BINS - 1)));
  return { lo: pick(0.02), hi: pick(0.98), colours };
}

export function binOf(ramp: Ramp, v: number): number {
  if (Number.isNaN(v)) return -1;
  const f = (v - ramp.lo) / (ramp.hi - ramp.lo || 1);
  return Math.max(0, Math.min(BINS - 1, Math.floor(f * BINS)));
}

function hex(colour: string): [number, number, number] {
  const m = colour.match(/^#([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1]!, 16) : 0x888888;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(stops: [number, number, number][], f: number): string {
  const seg = Math.min(stops.length - 2, Math.floor(f * (stops.length - 1)));
  const local = f * (stops.length - 1) - seg;
  const a = stops[seg]!;
  const b = stops[seg + 1]!;
  const c = a.map((v, i) => Math.round(v + (b[i]! - v) * local));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
