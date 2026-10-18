// The x axis as a projection of sample indices: kilometres or seconds. Cursor, pin and zoom are stored as
// indices, so switching the axis keeps them all.

import type { XAxis } from "../app/Preferences";
import type { ActivityStreams } from "../model/types";

export class XProjection {
  readonly values: Float64Array;

  constructor(readonly axis: XAxis, streams: ActivityStreams) {
    this.values = axis === "distance" && streams.distance ? streams.distance.map((m) => m / 1000) : streams.time;
  }

  at(index: number): number {
    return this.values[index]!;
  }

  /** The sample nearest to an x value (binary search; x is non-decreasing). */
  indexAt(x: number): number {
    const v = this.values;
    let lo = 0;
    let hi = v.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (v[mid]! < x) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(v[lo - 1]! - x) <= Math.abs(v[lo]! - x)) return lo - 1;
    return lo;
  }

  /** The step of Shift+arrow: 1 km or 1 minute, in samples from `index`. */
  bigStep(index: number, direction: -1 | 1): number {
    const target = this.at(index) + direction * (this.axis === "distance" ? 1 : 60);
    return this.indexAt(target) - index || direction;
  }
}
