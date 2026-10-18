// The rider's profile: the only owner of FTP, heart rates, weight and zone fractions; stored in the database.

import { Emitter } from "../app/Emitter";
import { EMPTY_PROFILE, type AthleteEntry, type AthleteProfile } from "../model/athlete";
import type { ChannelKey } from "../model/types";
import { Database, STORES } from "./Database";

const KEY = "athlete";

export class AthleteStore extends Emitter<{ changed: AthleteProfile }> {
  private value: AthleteProfile;

  private constructor(private readonly db: Database, profile: AthleteProfile) {
    super();
    this.value = profile;
  }

  static async open(db: Database): Promise<AthleteStore> {
    const stored = await db.get<AthleteProfile>(STORES.settings, KEY);
    return new AthleteStore(db, stored ?? EMPTY_PROFILE);
  }

  get profile(): AthleteProfile {
    return this.value;
  }

  hasEntries(): boolean {
    return this.value.entries.length > 0;
  }

  /** Adds an entry or replaces the one with the same id. */
  setEntry(entry: AthleteEntry): Promise<void> {
    const entries = [...this.value.entries.filter((e) => e.id !== entry.id), entry].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    return this.save({ ...this.value, entries });
  }

  removeEntry(id: string): Promise<void> {
    return this.save({ ...this.value, entries: this.value.entries.filter((e) => e.id !== id) });
  }

  setZoneFractions(channel: ChannelKey, fractions: readonly number[]): Promise<void> {
    return this.save({ ...this.value, zoneFractions: { ...this.value.zoneFractions, [channel]: fractions } });
  }

  clearZoneFractions(channel: ChannelKey): Promise<void> {
    const zoneFractions = { ...this.value.zoneFractions };
    delete zoneFractions[channel];
    return this.save({ ...this.value, zoneFractions });
  }

  private async save(profile: AthleteProfile): Promise<void> {
    await this.db.put([{ store: STORES.settings, key: KEY, value: profile }]);
    this.value = profile;
    this.emit("changed", profile);
  }
}
