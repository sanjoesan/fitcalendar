// Reads the bytes of a .fit file into plain messages: global message number + raw field values by field number.
// Knows the file format only (headers, definitions, compressed timestamps, CRCs) - what the fields mean is profile.ts.

import { baseType } from "./baseTypes";
import { fitCrc } from "./crc";

export type FieldValue = number | string | readonly number[];

export interface FitMessage {
  readonly global: number;
  readonly fields: ReadonlyMap<number, FieldValue>;
}

export type FitErrorCode = "not_fit" | "truncated" | "crc" | "not_activity" | "no_records";

export class FitError extends Error {
  constructor(readonly code: FitErrorCode, message: string) {
    super(message);
  }
}

interface FieldDefinition {
  readonly num: number;
  readonly size: number;
  readonly type: number;
}

interface MessageDefinition {
  readonly global: number;
  readonly littleEndian: boolean;
  readonly fields: readonly FieldDefinition[];
  /** Bytes of developer fields after the regular ones; skipped. */
  readonly developerBytes: number;
}

const TIMESTAMP_FIELD = 253;

/** Decodes every FIT file in `bytes` (chained files are read one after another). */
export function decodeFit(bytes: Uint8Array): FitMessage[] {
  const messages: FitMessage[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    offset = decodeOne(bytes, offset, messages);
    if (bytes.length - offset < 12) break; // trailing padding
  }
  return messages;
}

function decodeOne(bytes: Uint8Array, start: number, out: FitMessage[]): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length - start < 12) throw new FitError("not_fit", "file too short");
  const headerSize = bytes[start]!;
  const signature = String.fromCharCode(...bytes.subarray(start + 8, start + 12));
  if ((headerSize !== 12 && headerSize !== 14) || signature !== ".FIT") {
    throw new FitError("not_fit", "missing .FIT signature");
  }
  const dataSize = view.getUint32(start + 4, true);
  // A recorder that never finished its file (e.g. a ride aborted in Zwift) leaves the data size at 0.
  if (dataSize === 0) throw new FitError("truncated", "unfinished file: data size 0");
  const dataStart = start + headerSize;
  const dataEnd = dataStart + dataSize;
  if (dataEnd + 2 > bytes.length) throw new FitError("truncated", "file ends before its data");
  if (headerSize === 14) {
    const headerCrc = view.getUint16(start + 12, true);
    if (headerCrc !== 0 && headerCrc !== fitCrc(bytes, start, start + 12)) {
      throw new FitError("crc", "header checksum mismatch");
    }
  }
  if (view.getUint16(dataEnd, true) !== fitCrc(bytes, start, dataEnd)) {
    throw new FitError("crc", "file checksum mismatch");
  }

  const definitions = new Map<number, MessageDefinition>();
  let lastTimestamp = 0;
  let pos = dataStart;
  while (pos < dataEnd) {
    const header = bytes[pos++]!;
    if (header & 0x80) {
      // Compressed timestamp header: a data message whose timestamp is a 5-bit offset to the last one.
      const definition = requireDefinition(definitions, (header >> 5) & 0x03);
      const timeOffset = header & 0x1f;
      const lastLow = lastTimestamp % 0x20; // arithmetic, not bitwise: timestamps are unsigned 32-bit
      lastTimestamp = lastTimestamp - lastLow + timeOffset + (timeOffset < lastLow ? 0x20 : 0);
      const fields = readFields(view, bytes, pos, definition);
      fields.set(TIMESTAMP_FIELD, lastTimestamp);
      pos += messageSize(definition);
      out.push({ global: definition.global, fields });
    } else if (header & 0x40) {
      const [definition, size] = readDefinition(view, pos, (header & 0x20) !== 0);
      definitions.set(header & 0x0f, definition);
      pos += size;
    } else {
      const definition = requireDefinition(definitions, header & 0x0f);
      const fields = readFields(view, bytes, pos, definition);
      const timestamp = fields.get(TIMESTAMP_FIELD);
      if (typeof timestamp === "number") lastTimestamp = timestamp;
      pos += messageSize(definition);
      out.push({ global: definition.global, fields });
    }
    if (pos > dataEnd) throw new FitError("truncated", "message runs past the end of the data");
  }
  return dataEnd + 2;
}

function requireDefinition(definitions: Map<number, MessageDefinition>, local: number): MessageDefinition {
  const definition = definitions.get(local);
  if (!definition) throw new FitError("not_fit", `data message for undefined local type ${local}`);
  return definition;
}

function readDefinition(view: DataView, pos: number, hasDeveloperFields: boolean): [MessageDefinition, number] {
  const littleEndian = view.getUint8(pos + 1) === 0;
  const global = view.getUint16(pos + 2, littleEndian);
  const count = view.getUint8(pos + 4);
  const fields: FieldDefinition[] = [];
  let p = pos + 5;
  for (let i = 0; i < count; i++, p += 3) {
    fields.push({ num: view.getUint8(p), size: view.getUint8(p + 1), type: view.getUint8(p + 2) });
  }
  let developerBytes = 0;
  if (hasDeveloperFields) {
    const devCount = view.getUint8(p++);
    for (let i = 0; i < devCount; i++, p += 3) developerBytes += view.getUint8(p + 1);
  }
  return [{ global, littleEndian, fields, developerBytes }, p - pos];
}

function messageSize(definition: MessageDefinition): number {
  return definition.fields.reduce((sum, f) => sum + f.size, 0) + definition.developerBytes;
}

function readFields(view: DataView, bytes: Uint8Array, pos: number, definition: MessageDefinition): Map<number, FieldValue> {
  const fields = new Map<number, FieldValue>();
  let p = pos;
  for (const field of definition.fields) {
    const value = readValue(view, bytes, p, field, definition.littleEndian);
    if (value !== null) fields.set(field.num, value);
    p += field.size;
  }
  return fields;
}

const utf8 = new TextDecoder("utf-8");

function readValue(view: DataView, bytes: Uint8Array, pos: number, field: FieldDefinition, le: boolean): FieldValue | null {
  const type = baseType(field.type);
  if (pos + field.size > view.byteLength) throw new FitError("truncated", "field runs past the end of the file");
  if (type.isString) {
    const raw = bytes.subarray(pos, pos + field.size);
    const end = raw.indexOf(0);
    const text = utf8.decode(end < 0 ? raw : raw.subarray(0, end));
    return text.length > 0 ? text : null;
  }
  if (field.size % type.size !== 0) return null; // malformed field: skip it
  const count = field.size / type.size;
  if (count === 1) return type.read(view, pos, le);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = type.read(view, pos + i * type.size, le);
    if (v !== null) values.push(v);
  }
  return values.length > 0 ? values : null;
}
