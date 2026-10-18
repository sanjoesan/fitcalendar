// Writes small synthetic .fit files for the parser tests.

import { fitCrc } from "../../src/fit/crc";

export interface FieldDef { num: number; size: number; type: number }

export class FitBuilder {
  private readonly bytes: number[] = [];
  private bigEndian = false;

  define(local: number, global: number, fields: FieldDef[], opts: { bigEndian?: boolean; developerSizes?: number[] } = {}): this {
    this.bigEndian = opts.bigEndian ?? false;
    const dev = opts.developerSizes;
    this.bytes.push(0x40 | (dev ? 0x20 : 0) | local, 0, this.bigEndian ? 1 : 0);
    this.u16(global);
    this.bytes.push(fields.length);
    for (const f of fields) this.bytes.push(f.num, f.size, f.type);
    if (dev) {
      this.bytes.push(dev.length);
      dev.forEach((size, i) => this.bytes.push(i, size, 0));
    }
    return this;
  }

  /** One value per field, written with the field's size; developer bytes appended as zeros. */
  data(local: number, values: (number | string)[], sizes: number[], developerBytes = 0): this {
    this.bytes.push(local);
    return this.values(values, sizes, developerBytes);
  }

  compressed(local: number, timeOffset: number, values: (number | string)[], sizes: number[]): this {
    this.bytes.push(0x80 | (local << 5) | (timeOffset & 0x1f));
    return this.values(values, sizes, 0);
  }

  build({ headerSize = 14, corruptCrc = false }: { headerSize?: 12 | 14; corruptCrc?: boolean } = {}): Uint8Array {
    const header: number[] = [headerSize, 0x20, 0x08, 0x08];
    const size = this.bytes.length;
    header.push(size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff);
    header.push(...Array.from(".FIT", (c) => c.charCodeAt(0)));
    if (headerSize === 14) {
      const crc = fitCrc(Uint8Array.from(header));
      header.push(crc & 0xff, crc >> 8);
    }
    const body = Uint8Array.from([...header, ...this.bytes, 0, 0]);
    const crc = fitCrc(body, 0, body.length - 2) ^ (corruptCrc ? 1 : 0);
    body[body.length - 2] = crc & 0xff;
    body[body.length - 1] = crc >> 8;
    return body;
  }

  private values(values: (number | string)[], sizes: number[], developerBytes: number): this {
    values.forEach((v, i) => {
      const size = sizes[i]!;
      if (typeof v === "string") {
        const enc = new TextEncoder().encode(v);
        for (let b = 0; b < size; b++) this.bytes.push(enc[b] ?? 0);
      } else {
        const out: number[] = [];
        let x = BigInt.asUintN(size * 8, BigInt(Math.round(v)));
        for (let b = 0; b < size; b++) {
          out.push(Number(x & 0xffn));
          x >>= 8n;
        }
        this.bytes.push(...(this.bigEndian ? out.reverse() : out));
      }
    });
    for (let i = 0; i < developerBytes; i++) this.bytes.push(0);
    return this;
  }

  private u16(v: number): void {
    const lo = v & 0xff;
    const hi = (v >> 8) & 0xff;
    this.bytes.push(...(this.bigEndian ? [hi, lo] : [lo, hi]));
  }
}

/** FIT seconds for a UTC date. */
export const fitSeconds = (iso: string): number => (Date.parse(iso) - Date.UTC(1989, 11, 31)) / 1000;
