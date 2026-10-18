// What the detail page lists, as data: each statistic's label, how it is read from the figures and written.
// A group is shown when at least one of its statistics has a value; the tiles are a selection with a second line.

import type { TextKey } from "../i18n/de";
import type { Formatter } from "../i18n/format";
import { channelDef } from "../model/channels";
import type { ChannelKey } from "../model/types";
import type { Figures } from "./figures";

type Translate = (key: TextKey, params?: Readonly<Record<string, string | number>>) => string;

export interface StatContext {
  readonly fmt: Formatter;
  readonly t: Translate;
}

export interface StatDef {
  readonly labelKey: TextKey;
  readonly value: (f: Figures) => number | null | undefined;
  readonly format: (v: number, c: StatContext) => string;
  /** For values that depend on the rider's settings: where the setting came from. */
  readonly source?: (f: Figures) => "profile" | "file" | undefined;
}

export interface StatGroup {
  readonly titleKey: TextKey;
  readonly stats: readonly StatDef[];
}

const mean = (key: ChannelKey) => (f: Figures) => f.channels[key]?.mean;
const max = (key: ChannelKey) => (f: Figures) => f.channels[key]?.max;
const min = (key: ChannelKey) => (f: Figures) => f.channels[key]?.min;
const channel = (key: ChannelKey) => (v: number, c: StatContext) => c.fmt.channel(channelDef(key), v);
const watts = (v: number, c: StatContext) => `${c.fmt.number(v)} ${c.t("unit.w")}`;
const percent = (v: number, c: StatContext) => `${c.fmt.number(v * 100)} %`;
const percent1 = (v: number, c: StatContext) => `${c.fmt.number(v * 100, 1)} %`;
const pedal = (v: number, c: StatContext) => `${c.fmt.number(v)} %`;
const plain = (digits: number) => (v: number, c: StatContext) => c.fmt.number(v, digits);
const perKilo = (v: number, c: StatContext) => `${c.fmt.number(v, 2)} W/kg`;
const best = (duration: number) => (f: Figures) => f.power?.bestEfforts.find((e) => e.duration === duration)?.watts;
const ratio = (value: (f: Figures) => number | null | undefined, ref: (f: Figures) => number | undefined) => (f: Figures) => {
  const v = value(f);
  const r = ref(f);
  return v != null && r ? v / r : null;
};
const weight = (f: Figures) => f.athlete.values.weight;
const ftpSource = (f: Figures) => f.athlete.sources.ftp;
const weightSource = (f: Figures) => f.athlete.sources.weight;

export const STAT = {
  distance: { labelKey: "totals.distance", value: (f) => f.distance, format: (v, c) => c.fmt.distance(v) },
  movingTime: { labelKey: "stat.movingTime", value: (f) => f.movingTime, format: (v, c) => c.fmt.duration(v) },
  elapsedTime: { labelKey: "stat.elapsed", value: (f) => f.elapsedTime, format: (v, c) => c.fmt.duration(v) },
  ascent: { labelKey: "stat.ascent", value: (f) => f.ascent, format: (v, c) => c.fmt.ascent(v) },
  descent: { labelKey: "stat.descentLabel", value: (f) => f.descent, format: (v, c) => c.fmt.ascent(v) },
  minAltitude: { labelKey: "stat.minAltitude", value: min("altitude"), format: channel("altitude") },
  maxAltitude: { labelKey: "stat.maxAltitude", value: max("altitude"), format: channel("altitude") },
  gradient: { labelKey: "stat.gradient", value: (f) => f.netGradient, format: percent1 },
  maxGradient: { labelKey: "stat.maxGradient", value: max("gradient"), format: percent1 },
  movingSpeed: { labelKey: "stat.movingSpeed", value: mean("speed"), format: channel("speed") },
  overallSpeed: { labelKey: "stat.overallSpeed", value: (f) => (f.elapsedTime > 0 && f.distance > 0 ? f.distance / f.elapsedTime : null), format: channel("speed") },
  maxSpeed: { labelKey: "stat.maxSpeed", value: max("speed"), format: channel("speed") },
  heartRate: { labelKey: "stat.heartRate", value: mean("heartRate"), format: channel("heartRate") },
  maxHeartRate: { labelKey: "stat.maxHeartRate", value: max("heartRate"), format: channel("heartRate") },
  heartPctMax: { labelKey: "stat.heartPctMax", value: ratio(mean("heartRate"), (f) => f.athlete.values.maxHr), format: percent, source: (f) => f.athlete.sources.maxHr },
  power: { labelKey: "stat.power", value: mean("power"), format: watts },
  maxPower: { labelKey: "stat.maxPower", value: max("power"), format: watts },
  normalizedPower: { labelKey: "stat.normalizedPower", value: (f) => f.power?.normalized ?? f.device.normalizedPower, format: watts },
  best20: { labelKey: "stat.best20", value: best(1200), format: watts },
  intensity: { labelKey: "stat.intensity", value: (f) => f.load?.intensity, format: plain(2), source: ftpSource },
  tss: { labelKey: "stat.tss", value: (f) => f.load?.stress, format: plain(0), source: ftpSource },
  work: { labelKey: "stat.work", value: (f) => f.power?.work ?? f.device.work, format: (v, c) => `${c.fmt.number(v)} kJ` },
  powerPerKilo: { labelKey: "stat.powerPerKilo", value: ratio(mean("power"), weight), format: perKilo, source: weightSource },
  npPerKilo: { labelKey: "stat.npPerKilo", value: ratio((f) => f.power?.normalized, weight), format: perKilo, source: weightSource },
  ftp: { labelKey: "stat.ftp", value: (f) => f.athlete.values.ftp, format: watts, source: ftpSource },
  balance: { labelKey: "stat.balance", value: (f) => f.device.leftRightBalance ?? f.channels.balance?.mean, format: (v, c) => `${c.fmt.number(v)} % L · ${c.fmt.number(100 - v)} % R` },
  torqueLeft: { labelKey: "stat.torqueLeft", value: (f) => f.device.leftTorqueEffectiveness, format: pedal },
  torqueRight: { labelKey: "stat.torqueRight", value: (f) => f.device.rightTorqueEffectiveness, format: pedal },
  smoothLeft: { labelKey: "stat.smoothLeft", value: (f) => f.device.leftPedalSmoothness, format: pedal },
  smoothRight: { labelKey: "stat.smoothRight", value: (f) => f.device.rightPedalSmoothness, format: pedal },
  cadence: { labelKey: "stat.cadence", value: mean("cadence"), format: channel("cadence") },
  maxCadence: { labelKey: "stat.maxCadence", value: max("cadence"), format: channel("cadence") },
  temperature: { labelKey: "stat.temperature", value: mean("temperature"), format: channel("temperature") },
  minTemperature: { labelKey: "stat.minTemperature", value: min("temperature"), format: channel("temperature") },
  maxTemperature: { labelKey: "stat.maxTemperature", value: max("temperature"), format: channel("temperature") },
  aerobicTe: { labelKey: "stat.aerobicTe", value: (f) => f.device.trainingEffect, format: plain(1) },
  anaerobicTe: { labelKey: "stat.anaerobicTe", value: (f) => f.device.anaerobicTrainingEffect, format: plain(1) },
  deviceTss: { labelKey: "stat.deviceTss", value: (f) => f.device.trainingStress, format: plain(0) },
  calories: { labelKey: "stat.calories", value: (f) => f.calories, format: (v, c) => `${c.fmt.number(v)} ${c.t("unit.kcal")}` },
} satisfies Record<string, StatDef>;

export const STAT_GROUPS: readonly StatGroup[] = [
  { titleKey: "group.distanceTime", stats: [STAT.distance, STAT.movingTime, STAT.elapsedTime] },
  { titleKey: "group.elevation", stats: [STAT.ascent, STAT.descent, STAT.minAltitude, STAT.maxAltitude, STAT.gradient, STAT.maxGradient] },
  { titleKey: "group.speed", stats: [STAT.movingSpeed, STAT.overallSpeed, STAT.maxSpeed] },
  { titleKey: "group.heart", stats: [STAT.heartRate, STAT.maxHeartRate, STAT.heartPctMax] },
  {
    titleKey: "group.power",
    stats: [STAT.power, STAT.maxPower, STAT.normalizedPower, STAT.best20, STAT.intensity, STAT.tss, STAT.work, STAT.powerPerKilo, STAT.npPerKilo, STAT.ftp],
  },
  { titleKey: "group.pedals", stats: [STAT.balance, STAT.torqueLeft, STAT.torqueRight, STAT.smoothLeft, STAT.smoothRight] },
  { titleKey: "group.cadence", stats: [STAT.cadence, STAT.maxCadence] },
  { titleKey: "group.temperature", stats: [STAT.temperature, STAT.minTemperature, STAT.maxTemperature] },
  { titleKey: "group.training", stats: [STAT.aerobicTe, STAT.anaerobicTe, STAT.deviceTss, STAT.calories] },
];

export interface TileDef {
  readonly main: StatDef;
  /** The small second line, e.g. the maximum or the total time: `lineKey` with {v}. */
  readonly second?: { readonly stat: StatDef; readonly lineKey: TextKey };
}

export const TILES: readonly TileDef[] = [
  { main: STAT.distance },
  { main: STAT.movingTime, second: { stat: STAT.elapsedTime, lineKey: "stat.elapsedTime" } },
  { main: STAT.ascent, second: { stat: STAT.descent, lineKey: "stat.descent" } },
  { main: STAT.movingSpeed, second: { stat: STAT.maxSpeed, lineKey: "stat.max" } },
  { main: STAT.heartRate, second: { stat: STAT.maxHeartRate, lineKey: "stat.max" } },
  { main: STAT.power, second: { stat: STAT.maxPower, lineKey: "stat.max" } },
  { main: STAT.normalizedPower, second: { stat: STAT.best20, lineKey: "stat.best20Line" } },
  { main: STAT.tss, second: { stat: STAT.intensity, lineKey: "stat.ifLine" } },
];
