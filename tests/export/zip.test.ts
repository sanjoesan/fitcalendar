import { describe, expect, it } from "vitest";
import { crc32, uniqueNames, zip } from "../../src/export/zip";

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
  });

  it("writes local headers, a central directory and the end record", () => {
    const a = new TextEncoder().encode("first");
    const b = new TextEncoder().encode("second file");
    const archive = zip([
      { name: "a.fit", bytes: a, modified: new Date(2026, 9, 18, 12, 0, 0) },
      { name: "Giro di Castellina.fit", bytes: b, modified: new Date(2026, 9, 18, 12, 0, 0) },
    ]);
    const view = new DataView(archive.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = archive.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralStart = view.getUint32(end + 16, true);
    expect(view.getUint32(centralStart, true)).toBe(0x02014b50);
    // the second entry's data follows its header and name
    const second = 30 + 5 + a.length;
    expect(view.getUint32(second, true)).toBe(0x04034b50);
    expect(view.getUint32(second + 14, true)).toBe(crc32(b));
  });

  it("keeps names unique", () => {
    expect(uniqueNames(["ride.fit", "Ride.fit", "x.fit", "ride.fit"])).toEqual(["ride.fit", "Ride (2).fit", "x.fit", "ride (3).fit"]);
  });
});
