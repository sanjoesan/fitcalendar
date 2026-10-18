// Turns decoded FIT messages into one ParsedActivity: the ride's samples as columns, its laps, sport and totals.
// FIT-specific choices (enhanced fields first, which message names the ride) live here and nowhere else.

import type { DeviceMetrics, FileAthlete, SportKind } from "../model/types";
import { FitError, type FitMessage } from "./FitDecoder";
import {
  ACTIVITY, FILE_ID, FILE_TYPE_ACTIVITY, LAP, MESG, RECORD, SESSION, SPORT, TIME_IN_ZONE, USER_PROFILE, WORKOUT,
  ZONES_TARGET, num, numbers, text, type FieldSpec,
} from "./profile";

/** One value per sample; undefined where the record does not carry it. */
export type Column = (number | undefined)[];

export interface ParsedSamples {
  /** Epoch milliseconds, ascending, unique. */
  readonly timestamp: number[];
  readonly lat: Column;
  readonly lon: Column;
  readonly distance: Column;
  readonly altitude: Column;
  readonly speed: Column;
  readonly heartRate: Column;
  readonly cadence: Column;
  readonly power: Column;
  readonly temperature: Column;
  readonly balance: Column;
}

/** The device's own totals from the session message, where present. */
export interface DeviceTotals {
  readonly distance?: number;
  readonly movingTime?: number;
  readonly elapsedTime?: number;
  readonly ascent?: number;
  readonly descent?: number;
  readonly calories?: number;
}

export interface ParsedActivity {
  /** Identifies the recording (file_id); two exports of the same ride share it. Null if the file has no file_id. */
  readonly fileKey: string | null;
  readonly title: string | null;
  readonly sport: SportKind;
  readonly indoor: boolean;
  readonly deviceName: string | null;
  readonly deviceMetrics: DeviceMetrics;
  readonly athlete: FileAthlete;
  /** Minutes east of UTC from the activity message; null when the file does not say. */
  readonly tzOffsetMin: number | null;
  readonly totals: DeviceTotals;
  readonly samples: ParsedSamples;
  /** Laps as [start, end] epoch milliseconds. */
  readonly laps: readonly (readonly [number, number])[];
}

const SPORTS: ReadonlyMap<number, SportKind> = new Map<number, SportKind>([
  [1, "run"], [2, "ride"], [5, "swim"], [11, "walk"], [17, "hike"], [21, "ride"],
]);
/** Makers (file_id.manufacturer) named when the file has no product name. */
const MANUFACTURERS: ReadonlyMap<number, string> = new Map([
  [1, "Garmin"], [32, "Wahoo"], [69, "Stages"], [89, "Tacx"], [260, "Zwift"], [265, "Strava"], [267, "Bryton"], [289, "Hammerhead"], [294, "Coros"],
]);

/** Sub-sports recorded indoors: treadmill, indoor cycling, virtual activity, indoor running/walking. */
const INDOOR_SUB_SPORTS: ReadonlySet<number> = new Set([1, 6, 45, 58, 27]);

/** Record fields that become columns, preferred source first. */
const COLUMNS: Readonly<Record<Exclude<keyof ParsedSamples, "timestamp">, readonly FieldSpec[]>> = {
  lat: [RECORD.lat],
  lon: [RECORD.lon],
  distance: [RECORD.distance],
  altitude: [RECORD.enhancedAltitude, RECORD.altitude],
  speed: [RECORD.enhancedSpeed, RECORD.speed],
  heartRate: [RECORD.heartRate],
  cadence: [RECORD.cadence],
  power: [RECORD.power],
  temperature: [RECORD.temperature],
  balance: [RECORD.leftRightBalance],
};

/** Session fields that become DeviceMetrics. */
const DEVICE_FIELDS: Readonly<Record<keyof DeviceMetrics, FieldSpec>> = {
  normalizedPower: SESSION.normalizedPower,
  trainingStress: SESSION.trainingStress,
  intensityFactor: SESSION.intensityFactor,
  thresholdPower: SESSION.thresholdPower,
  work: SESSION.work,
  trainingEffect: SESSION.trainingEffect,
  anaerobicTrainingEffect: SESSION.anaerobicTrainingEffect,
  leftRightBalance: SESSION.leftRightBalance,
  leftTorqueEffectiveness: SESSION.leftTorqueEffectiveness,
  rightTorqueEffectiveness: SESSION.rightTorqueEffectiveness,
  leftPedalSmoothness: SESSION.leftPedalSmoothness,
  rightPedalSmoothness: SESSION.rightPedalSmoothness,
};

export function readActivity(messages: readonly FitMessage[]): ParsedActivity {
  const byType = (global: number) => messages.filter((m) => m.global === global);
  const fileId = byType(MESG.fileId)[0];
  const fileType = fileId ? num(fileId, FILE_ID.type) : undefined;
  if (fileType !== undefined && fileType !== FILE_TYPE_ACTIVITY) {
    throw new FitError("not_activity", `file type ${fileType} is not an activity`);
  }
  const samples = readSamples(byType(MESG.record));
  if (samples.timestamp.length < 2) throw new FitError("no_records", "the file has no samples");

  const sessions = byType(MESG.session);
  const sportMessage = byType(MESG.sport)[0];
  const sportCode = firstNumber(sessions, SESSION.sport) ?? (sportMessage && num(sportMessage, SPORT.sport));
  const subSportCode = firstNumber(sessions, SESSION.subSport) ?? (sportMessage && num(sportMessage, SPORT.subSport));

  return {
    fileKey: fileId ? fileKeyOf(fileId) : null,
    title: firstText(sessions, SESSION.profileName)
      ?? (sportMessage && text(sportMessage, SPORT.name))
      ?? firstText(byType(MESG.workout), WORKOUT.name)
      ?? null,
    sport: (sportCode !== undefined && SPORTS.get(sportCode)) || "other",
    indoor: subSportCode !== undefined && INDOOR_SUB_SPORTS.has(subSportCode),
    deviceName: (fileId && (text(fileId, FILE_ID.productName) ?? MANUFACTURERS.get(num(fileId, FILE_ID.manufacturer) ?? -1))) ?? null,
    deviceMetrics: Object.fromEntries(
      Object.entries(DEVICE_FIELDS).flatMap(([key, spec]) => {
        // Recorders without the metric often write 0 (e.g. Zwift's training effect): that is no value.
        const v = firstNumber(sessions, spec);
        return v === undefined || v <= 0 ? [] : [[key, v]];
      }),
    ) as DeviceMetrics,
    athlete: fileAthlete(messages),
    tzOffsetMin: timeZoneOffset(byType(MESG.activity)),
    totals: deviceTotals(sessions),
    samples,
    laps: byType(MESG.lap).flatMap((lap) => {
      const start = num(lap, LAP.startTime);
      const end = num(lap, LAP.timestamp);
      return start !== undefined && end !== undefined && end > start ? [[start, end] as const] : [];
    }),
  };
}

function readSamples(records: readonly FitMessage[]): ParsedSamples {
  const withTime = records
    .map((message) => ({ message, time: num(message, RECORD.timestamp) }))
    .filter((r): r is { message: FitMessage; time: number } => r.time !== undefined)
    .sort((a, b) => a.time - b.time);
  const timestamp: number[] = [];
  const columns = Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, [] as Column])) as Record<keyof typeof COLUMNS, Column>;
  for (const { message, time } of withTime) {
    // Several records with one timestamp (e.g. a separate HR record) merge into one sample.
    const merge = timestamp.length > 0 && timestamp[timestamp.length - 1] === time;
    if (!merge) timestamp.push(time);
    const index = timestamp.length - 1;
    for (const key of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
      let value: number | undefined;
      for (const spec of COLUMNS[key]) if ((value = num(message, spec)) !== undefined) break;
      if (value !== undefined || !merge) columns[key][index] = value ?? columns[key][index];
    }
  }
  for (const column of Object.values(columns)) column.length = timestamp.length;
  return { timestamp, ...columns };
}

function deviceTotals(sessions: readonly FitMessage[]): DeviceTotals {
  const sum = (spec: FieldSpec): number | undefined => {
    const values = sessions.map((s) => num(s, spec)).filter((v): v is number => v !== undefined);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) : undefined;
  };
  return {
    distance: sum(SESSION.distance),
    movingTime: sum(SESSION.timerTime),
    elapsedTime: sum(SESSION.elapsedTime),
    ascent: sum(SESSION.ascent),
    descent: sum(SESSION.descent),
    calories: sum(SESSION.calories),
  };
}

/** What the device knew about the rider: zones_target, user_profile and the session's time_in_zone message. */
function fileAthlete(messages: readonly FitMessage[]): FileAthlete {
  const target = messages.find((m) => m.global === MESG.zonesTarget);
  const user = messages.find((m) => m.global === MESG.userProfile);
  const zones = messages.find((m) => m.global === MESG.timeInZone && num(m, TIME_IN_ZONE.referenceMesg) === MESG.session)
    ?? messages.find((m) => m.global === MESG.timeInZone);
  const pick = (...values: (number | undefined)[]) => values.find((v) => v !== undefined && v > 0);
  const athlete: Record<string, unknown> = {
    ftp: pick(zones && num(zones, TIME_IN_ZONE.functionalThresholdPower), target && num(target, ZONES_TARGET.functionalThresholdPower)),
    maxHr: pick(zones && num(zones, TIME_IN_ZONE.maxHeartRate), target && num(target, ZONES_TARGET.maxHeartRate)),
    restHr: pick(zones && num(zones, TIME_IN_ZONE.restingHeartRate), user && num(user, USER_PROFILE.restingHeartRate)),
    lthr: pick(zones && num(zones, TIME_IN_ZONE.thresholdHeartRate), target && num(target, ZONES_TARGET.thresholdHeartRate)),
    weight: pick(user && num(user, USER_PROFILE.weight)),
    hrZoneTops: zones && numbers(zones, TIME_IN_ZONE.hrZoneHighBoundary),
    powerZoneTops: zones && numbers(zones, TIME_IN_ZONE.powerZoneHighBoundary),
  };
  for (const key of Object.keys(athlete)) if (athlete[key] === undefined) delete athlete[key];
  return athlete as FileAthlete;
}

function timeZoneOffset(activities: readonly FitMessage[]): number | null {
  const activity = activities[0];
  if (!activity) return null;
  const utc = num(activity, ACTIVITY.timestamp);
  const local = num(activity, ACTIVITY.localTimestamp);
  if (utc === undefined || local === undefined) return null;
  const minutes = Math.round((local - utc) / 60 / 15) * 15; // offsets come in quarter hours
  return Math.abs(minutes) <= 14 * 60 ? minutes : null;
}

function fileKeyOf(fileId: FitMessage): string | null {
  const created = num(fileId, FILE_ID.timeCreated);
  if (created === undefined) return null;
  const parts = [FILE_ID.manufacturer, FILE_ID.product, FILE_ID.serialNumber].map((spec) => num(fileId, spec) ?? "");
  return [...parts, created].join(":");
}

function firstNumber(messages: readonly FitMessage[], spec: FieldSpec): number | undefined {
  for (const m of messages) {
    const v = num(m, spec);
    if (v !== undefined) return v;
  }
  return undefined;
}

function firstText(messages: readonly FitMessage[], spec: FieldSpec): string | undefined {
  for (const m of messages) {
    const v = text(m, spec)?.trim();
    if (v) return v;
  }
  return undefined;
}
