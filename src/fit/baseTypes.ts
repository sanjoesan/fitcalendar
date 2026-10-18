// The FIT base types: how many bytes a value takes, how it is read and which raw value means "no value".

export interface BaseType {
  readonly size: number;
  readonly isString?: boolean;
  /** Reads one value; returns null for the type's invalid sentinel. */
  read(view: DataView, offset: number, littleEndian: boolean): number | null;
}

function integer(size: 1 | 2 | 4, signed: boolean, invalid: number): BaseType {
  return {
    size,
    read(view, offset, le) {
      let v: number;
      if (size === 1) v = signed ? view.getInt8(offset) : view.getUint8(offset);
      else if (size === 2) v = signed ? view.getInt16(offset, le) : view.getUint16(offset, le);
      else v = signed ? view.getInt32(offset, le) : view.getUint32(offset, le);
      return v === invalid ? null : v;
    },
  };
}

function integer64(signed: boolean, invalid: bigint): BaseType {
  return {
    size: 8,
    read(view, offset, le) {
      const v = signed ? view.getBigInt64(offset, le) : view.getBigUint64(offset, le);
      return v === invalid ? null : Number(v);
    },
  };
}

function float(size: 4 | 8): BaseType {
  return {
    size,
    read(view, offset, le) {
      // The invalid sentinel (all bits set) is a NaN.
      const v = size === 4 ? view.getFloat32(offset, le) : view.getFloat64(offset, le);
      return Number.isFinite(v) ? v : null;
    },
  };
}

const STRING: BaseType = { size: 1, isString: true, read: (view, offset) => view.getUint8(offset) };

/** Keyed by the base type number (the low five bits of the base type byte). */
const BASE_TYPES: ReadonlyMap<number, BaseType> = new Map<number, BaseType>([
  [0x00, integer(1, false, 0xff)], // enum
  [0x01, integer(1, true, 0x7f)], // sint8
  [0x02, integer(1, false, 0xff)], // uint8
  [0x03, integer(2, true, 0x7fff)], // sint16
  [0x04, integer(2, false, 0xffff)], // uint16
  [0x05, integer(4, true, 0x7fffffff)], // sint32
  [0x06, integer(4, false, 0xffffffff)], // uint32
  [0x07, STRING], // string
  [0x08, float(4)], // float32
  [0x09, float(8)], // float64
  [0x0a, integer(1, false, 0x00)], // uint8z
  [0x0b, integer(2, false, 0x0000)], // uint16z
  [0x0c, integer(4, false, 0x00000000)], // uint32z
  [0x0d, integer(1, false, 0xff)], // byte
  [0x0e, integer64(true, 0x7fffffffffffffffn)], // sint64
  [0x0f, integer64(false, 0xffffffffffffffffn)], // uint64
  [0x10, integer64(false, 0n)], // uint64z
]);

const BYTES: BaseType = integer(1, false, -1);

export function baseType(byte: number): BaseType {
  return BASE_TYPES.get(byte & 0x1f) ?? BYTES;
}
