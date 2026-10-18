// The rider's profile over time and how a ride finds its values: FTP, heart rates, weight and zone boundaries.

import { ZONE_SCHEMES, type ZoneScheme } from "./zones";
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

export type ValueSource = "profile" | "file";

export interface RideAthlete {
  readonly values: AthleteValues;
  readonly sources: Partial<Record<AthleteField, ValueSource>>;
}

/** The values for one ride: the profile first, what the device wrote into the file where the profile has nothing. */
export function athleteForRide(profile: AthleteProfile, ride: ActivitySummary): RideAthlete {
  const fromProfile = profileValuesAt(profile, ride.day);
  const values: Partial<Record<AthleteField, number>> = {};
  const sources: Partial<Record<AthleteField, ValueSource>> = {};
  for (const field of ATHLETE_FIELDS) {
    const p = fromProfile[field];
    const f = ride.fileAthlete[field];
    if (p !== undefined) { values[field] = p; sources[field] = "profile"; }
    else if (f !== undefined) { values[field] = f; sources[field] = "file"; }
  }
  return { values, sources };
}

export interface ResolvedZones {
  readonly scheme: ZoneScheme;
  /** Absolute lower bound of each zone (W or bpm). */
  readonly lowerBounds: readonly number[];
  readonly reference: number;
  readonly source: ValueSource;
}

/** The zone boundaries of a ride for a scheme, or null when neither profile nor file gives the reference. */
export function zonesForRide(scheme: ZoneScheme, profile: AthleteProfile, ride: ActivitySummary, athlete: RideAthlete): ResolvedZones | null {
  const reference = athlete.values[scheme.reference];
  const source = athlete.sources[scheme.reference];
  const custom = profile.zoneFractions[scheme.channel];
  const fractions = custom && custom.length === scheme.zones.length ? custom : scheme.zones.map((z) => z.from);
  if (reference === undefined || source === undefined) return null;
  // A file's own zone table is used when the reference came from the file too and the user has not set fractions.
  const tops = scheme.reference === "ftp" ? ride.fileAthlete.powerZoneTops : ride.fileAthlete.hrZoneTops;
  if (source === "file" && !custom && tops) {
    const zoneTops = tops.length === scheme.zones.length + 1 ? tops.slice(1) : tops;
    if (zoneTops.length === scheme.zones.length) {
      return { scheme, reference, source, lowerBounds: [0, ...zoneTops.slice(0, -1).map((t) => t + 1)] };
    }
  }
  return { scheme, reference, source, lowerBounds: fractions.map((f) => f * reference) };
}

export function schemeFor(channel: ChannelKey): ZoneScheme | undefined {
  return ZONE_SCHEMES.find((s) => s.channel === channel);
}
