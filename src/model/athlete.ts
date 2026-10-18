// The rider's profile over time and how a ride finds its values: FTP, heart rates, weight and zone boundaries.
// Only what the rider entered counts - never values a device wrote into a file (user 2026-10-18).

import type { ZoneScheme } from "./zones";
import type { ActivitySummary, AthleteValues, ChannelKey } from "./types";

export type AthleteField = keyof AthleteValues;

export const ATHLETE_FIELDS: readonly AthleteField[] = ["ftp", "maxHr", "restHr", "lthr", "weight"];

/** One dated change of the profile; fields left out keep their earlier value. */
export interface AthleteEntry extends AthleteValues {
  readonly id: string;
  /** Day key from which the entry applies. */
  readonly validFrom: string;
}

export interface AthleteProfile {
  /** Sorted by validFrom. */
  readonly entries: readonly AthleteEntry[];
  /** Lower bounds as fractions of the reference, per zoned channel; missing: the scheme's defaults. */
  readonly zoneFractions: Partial<Record<ChannelKey, readonly number[]>>;
}

export const EMPTY_PROFILE: AthleteProfile = { entries: [], zoneFractions: {} };

/** The profile's value of every field on a day: the latest entry up to that day that sets it. Rides before the
 *  first entry use the first entry - a value entered today should still sort old rides into zones. */
export function profileValuesAt(profile: AthleteProfile, day: string): AthleteValues {
  const values: Partial<Record<AthleteField, number>> = {};
  for (const field of ATHLETE_FIELDS) {
    const setting = profile.entries.filter((e) => e[field] !== undefined);
    const valid = setting.filter((e) => e.validFrom <= day);
    const entry = valid.at(-1) ?? setting[0];
    if (entry) values[field] = entry[field]!;
  }
  return values;
}

/** The rider's values for one ride: those of the profile on the ride's day. Nothing comes from the ride's file. */
export function athleteForRide(profile: AthleteProfile, ride: ActivitySummary): AthleteValues {
  return profileValuesAt(profile, ride.day);
}

export interface ResolvedZones {
  readonly scheme: ZoneScheme;
  /** Absolute lower bound of each zone (W or bpm). */
  readonly lowerBounds: readonly number[];
  readonly reference: number;
}

/** The zone boundaries for a scheme from the rider's reference value, or null when the profile has none. */
export function zonesForRide(scheme: ZoneScheme, profile: AthleteProfile, athlete: AthleteValues): ResolvedZones | null {
  const reference = athlete[scheme.reference];
  if (reference === undefined) return null;
  const custom = profile.zoneFractions[scheme.channel];
  const fractions = custom && custom.length === scheme.zones.length ? custom : scheme.zones.map((z) => z.from);
  return { scheme, reference, lowerBounds: fractions.map((f) => f * reference) };
}
