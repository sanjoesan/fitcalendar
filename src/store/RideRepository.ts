// The rides: the only owner of what is stored. Keeps every summary in memory for the calendar, loads streams and
// original files on demand, and tells everyone when rides come or go.

import { Emitter } from "../app/Emitter";
import type { Activity, ActivityStreams, ActivitySummary } from "../model/types";
import { Database, STORES } from "./Database";

interface StoredFile {
  readonly id: string;
  readonly fileName: string;
  readonly bytes: ArrayBuffer;
}

/** Everything a ride consists of - what delete hands back so undo can put it back. */
export interface StoredRide {
  readonly activity: Activity;
  readonly bytes: ArrayBuffer;
}

export interface RidesChanged {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly updated: readonly string[];
}

export class RideRepository extends Emitter<{ changed: RidesChanged }> {
  private readonly summaries = new Map<string, ActivitySummary>();
  /** Rides sorted by start, rebuilt on change. */
  private sorted: ActivitySummary[] = [];

  private constructor(private readonly db: Database) {
    super();
  }

  static async open(db: Database): Promise<RideRepository> {
    const repository = new RideRepository(db);
    for (const s of await db.getAll<ActivitySummary>(STORES.summaries)) repository.summaries.set(s.id, s);
    repository.resort();
    return repository;
  }

  all(): readonly ActivitySummary[] {
    return this.sorted;
  }

  get(id: string): ActivitySummary | undefined {
    return this.summaries.get(id);
  }

  has(id: string): boolean {
    return this.summaries.has(id);
  }

  /** The ride recorded by the same device at the same moment, if one is stored. */
  findByFileKey(fileKey: string): ActivitySummary | undefined {
    return this.sorted.find((s) => s.fileKey === fileKey);
  }

  /** The rides of each day between two day keys (inclusive). */
  byDay(firstDay: string, lastDay: string): Map<string, ActivitySummary[]> {
    const days = new Map<string, ActivitySummary[]>();
    for (const s of this.sorted) {
      if (s.day < firstDay || s.day > lastDay) continue;
      const list = days.get(s.day);
      if (list) list.push(s);
      else days.set(s.day, [s]);
    }
    return days;
  }

  /** The ride before / after in time. */
  neighbour(id: string, step: -1 | 1): ActivitySummary | undefined {
    const index = this.sorted.findIndex((s) => s.id === id);
    return index < 0 ? undefined : this.sorted[index + step];
  }

  streams(id: string): Promise<ActivityStreams | undefined> {
    return this.db.get<ActivityStreams>(STORES.streams, id);
  }

  async file(id: string): Promise<StoredFile | undefined> {
    return this.db.get<StoredFile>(STORES.files, id);
  }

  async add(rides: readonly StoredRide[]): Promise<void> {
    if (rides.length === 0) return;
    await this.db.put(rides.flatMap(({ activity, bytes }) => [
      { store: STORES.summaries, value: activity.summary },
      { store: STORES.streams, value: activity.streams },
      { store: STORES.files, value: { id: activity.summary.id, fileName: activity.summary.fileName, bytes } satisfies StoredFile },
    ]));
    for (const { activity } of rides) this.summaries.set(activity.summary.id, activity.summary);
    this.resort();
    this.emit("changed", { added: rides.map((r) => r.activity.summary.id), removed: [], updated: [] });
  }

  /** Replaces a ride's summary and streams (rename, rebuilt after a parser update); the file stays. */
  async update(activity: Activity | { summary: ActivitySummary }): Promise<void> {
    const records: { store: typeof STORES.summaries | typeof STORES.streams; value: unknown }[] = [
      { store: STORES.summaries, value: activity.summary },
    ];
    if ("streams" in activity) records.push({ store: STORES.streams, value: activity.streams });
    await this.db.put(records);
    this.summaries.set(activity.summary.id, activity.summary);
    this.resort();
    this.emit("changed", { added: [], removed: [], updated: [activity.summary.id] });
  }

  async rename(id: string, title: string | null): Promise<void> {
    const summary = this.summaries.get(id);
    if (summary) await this.update({ summary: { ...summary, title } });
  }

  /** Deletes a ride and returns it whole, so it can be restored with add(). */
  async remove(id: string): Promise<StoredRide | undefined> {
    const summary = this.summaries.get(id);
    const [streams, file] = await Promise.all([this.streams(id), this.file(id)]);
    if (!summary || !streams || !file) return undefined;
    await this.db.delete([STORES.summaries, STORES.streams, STORES.files], id);
    this.summaries.delete(id);
    this.resort();
    this.emit("changed", { added: [], removed: [id], updated: [] });
    return { activity: { summary, streams }, bytes: file.bytes };
  }

  private resort(): void {
    this.sorted = [...this.summaries.values()].sort((a, b) => a.start - b.start);
  }
}
