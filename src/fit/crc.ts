// The FIT CRC-16 (the checksum after the header and at the end of every .fit file).

const TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

export function fitCrc(bytes: Uint8Array, start = 0, end = bytes.length, seed = 0): number {
  let crc = seed;
  for (let i = start; i < end; i++) {
    const byte = bytes[i]!;
    let tmp = TABLE[crc & 0xf]!;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ TABLE[byte & 0xf]!;
    tmp = TABLE[crc & 0xf]!;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ TABLE[(byte >> 4) & 0xf]!;
  }
  return crc;
}
