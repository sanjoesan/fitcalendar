// The road's gradient at every sample, over a distance window so GPS and altitude noise do not spike it.

const WINDOW_M = 50;

/** Fraction (0.05 = 5 %); NaN where there is not enough distance around the sample. */
export function gradient(distance: Float64Array, altitude: Float64Array): Float64Array {
  const n = distance.length;
  const out = new Float64Array(n).fill(Number.NaN);
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const d = distance[i]!;
    while (lo < i && distance[lo]! < d - WINDOW_M / 2) lo++;
    while (hi < n - 1 && distance[hi]! < d + WINDOW_M / 2) hi++;
    const run = distance[hi]! - distance[lo]!;
    const rise = altitude[hi]! - altitude[lo]!;
    if (run >= WINDOW_M / 2 && !Number.isNaN(rise)) out[i] = rise / run;
  }
  return out;
}
