// A centred moving average over time, for the curves' smoothing setting (the statistics always use raw values).

export function smooth(time: Float64Array, values: Float64Array, windowS: number): Float64Array {
  if (windowS <= 0) return values;
  const n = values.length;
  const out = new Float64Array(n);
  const half = windowS / 2;
  let lo = 0;
  let hi = 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    while (hi < n && time[hi]! <= time[i]! + half) {
      if (!Number.isNaN(values[hi]!)) { sum += values[hi]!; count++; }
      hi++;
    }
    while (time[lo]! < time[i]! - half) {
      if (!Number.isNaN(values[lo]!)) { sum -= values[lo]!; count--; }
      lo++;
    }
    out[i] = Number.isNaN(values[i]!) || count === 0 ? Number.NaN : sum / count;
  }
  return out;
}
