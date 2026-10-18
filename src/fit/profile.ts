// The part of the FIT profile this app reads: message numbers, field numbers and how a raw value becomes a unit.

import type { FitMessage } from "./FitDecoder";

export const MESG = {
  fileId: 0,
  sport: 12,
  session: 18,
  lap: 19,
  record: 20,
  workout: 26,
  activity: 34,
} as const;

/** How one field is turned into an SI value: value = raw / scale - offset, or a special conversion. */
export interface FieldSpec {
  readonly num: number;
  readonly scale?: number;
  readonly offset?: number;
  readonly convert?: (raw: number) => number;
}

/** FIT time: seconds since 1989-12-31T00:00:00Z. Returned as epoch milliseconds. */
const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);
const fitTime = (raw: number): number => FIT_EPOCH_MS + raw * 1000;
const semicircles = (raw: number): number => (raw * 180) / 2 ** 31;
/** left_right_balance: a share in percent, of the right pedal when the top bit is set. Returned as the left share. */
const leftShare8 = (raw: number): number => ((raw & 0x80) ? 100 - (raw & 0x7f) : raw & 0x7f);
const leftShare16 = (raw: number): number => ((raw & 0x8000) ? 100 - (raw & 0x3fff) / 100 : (raw & 0x3fff) / 100);

export const FILE_ID = {
  type: { num: 0 },
  manufacturer: { num: 1 },
  product: { num: 2 },
  serialNumber: { num: 3 },
  timeCreated: { num: 4, convert: fitTime },
  productName: { num: 8 },
} as const satisfies Record<string, FieldSpec>;

export const SPORT = {
  sport: { num: 0 },
  subSport: { num: 1 },
  name: { num: 3 },
} as const satisfies Record<string, FieldSpec>;

export const SESSION = {
  timestamp: { num: 253, convert: fitTime },
  startTime: { num: 2, convert: fitTime },
  sport: { num: 5 },
  subSport: { num: 6 },
  elapsedTime: { num: 7, scale: 1000 },
  timerTime: { num: 8, scale: 1000 },
  distance: { num: 9, scale: 100 },
  calories: { num: 11 },
  ascent: { num: 22 },
  descent: { num: 23 },
  trainingEffect: { num: 24, scale: 10 },
  normalizedPower: { num: 34 },
  leftRightBalance: { num: 37, convert: leftShare16 },
  work: { num: 48, scale: 1000 },
  leftTorqueEffectiveness: { num: 101, scale: 2 },
  rightTorqueEffectiveness: { num: 102, scale: 2 },
  leftPedalSmoothness: { num: 103, scale: 2 },
  rightPedalSmoothness: { num: 104, scale: 2 },
  profileName: { num: 110 },
  anaerobicTrainingEffect: { num: 137, scale: 10 },
} as const satisfies Record<string, FieldSpec>;

export const WORKOUT = {
  name: { num: 8 },
} as const satisfies Record<string, FieldSpec>;

export const ACTIVITY = {
  timestamp: { num: 253 },
  /** Local wall-clock time in FIT seconds; minus timestamp = the time zone offset. */
  localTimestamp: { num: 5 },
} as const satisfies Record<string, FieldSpec>;

export const LAP = {
  timestamp: { num: 253, convert: fitTime },
  startTime: { num: 2, convert: fitTime },
} as const satisfies Record<string, FieldSpec>;

export const RECORD = {
  timestamp: { num: 253, convert: fitTime },
  lat: { num: 0, convert: semicircles },
  lon: { num: 1, convert: semicircles },
  altitude: { num: 2, scale: 5, offset: 500 },
  enhancedAltitude: { num: 78, scale: 5, offset: 500 },
  heartRate: { num: 3 },
  cadence: { num: 4 },
  distance: { num: 5, scale: 100 },
  speed: { num: 6, scale: 1000 },
  enhancedSpeed: { num: 73, scale: 1000 },
  power: { num: 7 },
  temperature: { num: 13 },
  leftRightBalance: { num: 30, convert: leftShare8 },
} as const satisfies Record<string, FieldSpec>;

/** File types (file_id.type) */
export const FILE_TYPE_ACTIVITY = 4;

/** The field as a number in its unit, or undefined when the message does not carry it. */
export function num(message: FitMessage, spec: FieldSpec): number | undefined {
  const raw = message.fields.get(spec.num);
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "number") return undefined;
  if (spec.convert) return spec.convert(value);
  return value / (spec.scale ?? 1) - (spec.offset ?? 0);
}

export function text(message: FitMessage, spec: FieldSpec): string | undefined {
  const raw = message.fields.get(spec.num);
  return typeof raw === "string" ? raw : undefined;
}
