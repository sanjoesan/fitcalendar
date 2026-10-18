// Training zones as data: power zones from FTP (Coggan, 7 zones), heart-rate zones from the maximum heart rate (5 zones).

import type { TextKey } from "../i18n/de";
import type { ChannelKey } from "./types";

export interface ZoneDef {
  /** Default lower bound as a fraction of the reference (FTP or max HR); the zone ends where the next begins. */
  readonly from: number;
  readonly nameKey: TextKey;
  /** CSS custom property of the zone's colour. */
  readonly colour: string;
}

export interface ZoneScheme {
  readonly channel: ChannelKey;
  readonly titleKey: TextKey;
  /** Which athlete value the fractions refer to. */
  readonly reference: "ftp" | "maxHr";
  readonly zones: readonly ZoneDef[];
}

export const HEART_ZONES: ZoneScheme = {
  channel: "heartRate",
  titleKey: "zones.heart",
  reference: "maxHr",
  zones: [
    { from: 0, nameKey: "zones.h1", colour: "--zone-1" },
    { from: 0.6, nameKey: "zones.h2", colour: "--zone-2" },
    { from: 0.7, nameKey: "zones.h3", colour: "--zone-4" },
    { from: 0.8, nameKey: "zones.h4", colour: "--zone-5" },
    { from: 0.9, nameKey: "zones.h5", colour: "--zone-7" },
  ],
};

export const POWER_ZONES: ZoneScheme = {
  channel: "power",
  titleKey: "zones.power",
  reference: "ftp",
  zones: [
    { from: 0, nameKey: "zones.p1", colour: "--zone-1" },
    { from: 0.55, nameKey: "zones.p2", colour: "--zone-2" },
    { from: 0.75, nameKey: "zones.p3", colour: "--zone-3" },
    { from: 0.9, nameKey: "zones.p4", colour: "--zone-4" },
    { from: 1.05, nameKey: "zones.p5", colour: "--zone-5" },
    { from: 1.2, nameKey: "zones.p6", colour: "--zone-6" },
    { from: 1.5, nameKey: "zones.p7", colour: "--zone-7" },
  ],
};

export const ZONE_SCHEMES: readonly ZoneScheme[] = [HEART_ZONES, POWER_ZONES];

/** Seconds spent in each zone. `weights` are each sample's moving seconds relative to `from` (see movingWeights). */
export function timeInZones(lowerBounds: readonly number[], values: Float64Array, weights: Float64Array, from: number, to: number): number[] {
  const seconds = new Array<number>(lowerBounds.length).fill(0);
  for (let i = from; i <= to; i++) {
    const v = values[i]!;
    const w = weights[i - from]!;
    if (Number.isNaN(v) || w === 0) continue;
    let z = lowerBounds.length - 1;
    while (z > 0 && v < lowerBounds[z]!) z--;
    seconds[z] = seconds[z]! + w;
  }
  return seconds;
}

/** The zone a value falls in. */
export function zoneIndex(lowerBounds: readonly number[], value: number): number {
  let z = lowerBounds.length - 1;
  while (z > 0 && value < lowerBounds[z]!) z--;
  return z;
}
