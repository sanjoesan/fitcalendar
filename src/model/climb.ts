// Elevation gain and loss from an altitude stream - one rule for whole rides, laps and selections.

/** Altitude changes smaller than this are treated as noise. 1 m: the same rule Tuscany Ride uses when it writes
 *  total_ascent, so a ride's own total and the sum of its laps and selections agree. */
const THRESHOLD_M = 1;

export interface Climb {
  readonly ascent: number;
  readonly descent: number;
}

/** Ascent and descent between two sample indices (inclusive), with a hysteresis against sensor noise. */
export function climb(altitude: Float64Array, from: number, to: number): Climb {
  let ascent = 0;
  let descent = 0;
  let reference = Number.NaN;
  for (let i = from; i <= to; i++) {
    const a = altitude[i]!;
    if (Number.isNaN(a)) continue;
    if (Number.isNaN(reference)) {
      reference = a;
    } else if (a - reference >= THRESHOLD_M) {
      ascent += a - reference;
      reference = a;
    } else if (reference - a >= THRESHOLD_M) {
      descent += reference - a;
      reference = a;
    }
  }
  return { ascent, descent };
}
