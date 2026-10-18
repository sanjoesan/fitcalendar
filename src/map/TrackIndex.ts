// Finds the track sample nearest to a point on the map, fast: the samples are bucketed in a grid of cells.
// Where the track passes a spot twice (out and back), the pass nearest in time to the current cursor wins,
// so moving the pointer along the road stays on the same pass.

const CELLS_ACROSS = 64;

export class TrackIndex {
  private readonly cells = new Map<string, number[]>();
  private readonly cellSize: number;
  private readonly kx: number;

  constructor(private readonly lat: Float64Array, private readonly lon: Float64Array) {
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (let i = 0; i < lat.length; i++) {
      if (Number.isNaN(lat[i]!)) continue;
      minLat = Math.min(minLat, lat[i]!); maxLat = Math.max(maxLat, lat[i]!);
      minLon = Math.min(minLon, lon[i]!); maxLon = Math.max(maxLon, lon[i]!);
    }
    this.kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    this.cellSize = Math.max((maxLat - minLat) / CELLS_ACROSS, ((maxLon - minLon) * this.kx) / CELLS_ACROSS, 1e-5);
    for (let i = 0; i < lat.length; i++) {
      if (Number.isNaN(lat[i]!)) continue;
      const key = this.key(this.cell(lat[i]!), this.cell(lon[i]! * this.kx));
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    }
  }

  /** The nearest sample within `radiusDeg` (in latitude degrees), or null. `near`: the current cursor sample. */
  nearest(lat: number, lon: number, radiusDeg: number, near: number | null): number | null {
    const y = lat;
    const x = lon * this.kx;
    const r = Math.ceil(radiusDeg / this.cellSize);
    const cy = this.cell(y);
    const cx = this.cell(x);
    const candidates: { index: number; d: number }[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        for (const i of this.cells.get(this.key(cy + dy, cx + dx)) ?? []) {
          const d = Math.hypot(this.lat[i]! - y, this.lon[i]! * this.kx - x);
          if (d <= radiusDeg) candidates.push({ index: i, d });
        }
      }
    }
    if (candidates.length === 0) return null;
    const best = Math.min(...candidates.map((c) => c.d));
    const close = candidates.filter((c) => c.d <= best + radiusDeg * 0.25);
    if (near === null) return close.reduce((a, b) => (b.d < a.d ? b : a)).index;
    return close.reduce((a, b) => (Math.abs(b.index - near) < Math.abs(a.index - near) ? b : a)).index;
  }

  private cell(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  private key(y: number, x: number): string {
    return `${y}:${x}`;
  }
}
