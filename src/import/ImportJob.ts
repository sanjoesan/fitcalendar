// The import: the only owner of the queue of files and of each file's result. Parses in a worker, skips duplicates,
// stores each new ride at once (the calendar fills while the import runs).

import { Emitter } from "../app/Emitter";
import type { FitErrorCode } from "../fit/FitDecoder";
import type { RideRepository } from "../store/RideRepository";
import type { ParseOutcome } from "./parseFile";
import type { ParseRequest } from "./fit.worker";

export type ImportStatus = "waiting" | "parsing" | "added" | "duplicate" | "error";

export interface ImportResult {
  readonly fileName: string;
  readonly status: ImportStatus;
  /** The new ride, or the stored ride a duplicate matches. */
  readonly rideId?: string;
  readonly day?: string;
  readonly errorCode?: FitErrorCode | "unknown";
}

export interface ImportProgress {
  readonly results: readonly ImportResult[];
  readonly running: boolean;
}

export class ImportJob extends Emitter<{ progress: ImportProgress; finished: ImportProgress }> {
  private results: ImportResult[] = [];
  private queue: { index: number; file: File }[] = [];
  private running = false;
  private worker: Worker | null = null;

  constructor(private readonly repository: RideRepository) {
    super();
  }

  get progress(): ImportProgress {
    return { results: this.results, running: this.running };
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Adds files to the import; starts it when it is not running. A finished import's list is cleared first. */
  add(files: readonly File[]): void {
    const fitFiles = files.filter((f) => /\.fit$/i.test(f.name));
    if (fitFiles.length === 0) return;
    if (!this.running) this.results = [];
    for (const file of fitFiles) {
      this.queue.push({ index: this.results.length, file });
      this.results.push({ fileName: file.name, status: "waiting" });
    }
    this.emit("progress", this.progress);
    if (!this.running) void this.drain();
  }

  /** Forgets the finished list (the panel was closed). */
  clear(): void {
    if (this.running) return;
    this.results = [];
    this.emit("progress", this.progress);
  }

  private async drain(): Promise<void> {
    this.running = true;
    this.worker ??= new Worker(new URL("./fit.worker.ts", import.meta.url), { type: "module" });
    for (let next = this.queue.shift(); next; next = this.queue.shift()) {
      this.setResult(next.index, { fileName: next.file.name, status: "parsing" });
      this.setResult(next.index, await this.importOne(next.file));
    }
    this.running = false;
    this.worker.terminate();
    this.worker = null;
    this.emit("progress", this.progress);
    this.emit("finished", this.progress);
  }

  private async importOne(file: File): Promise<ImportResult> {
    const fileName = file.name;
    try {
      const bytes = await file.arrayBuffer();
      const outcome = await this.parse({ bytes: bytes.slice(0), fileName, importedAt: Date.now() });
      if (!outcome.ok) return { fileName, status: "error", errorCode: outcome.code };
      const { summary } = outcome.activity;
      const existing = this.repository.get(summary.id) ?? (summary.fileKey ? this.repository.findByFileKey(summary.fileKey) : undefined);
      if (existing) return { fileName, status: "duplicate", rideId: existing.id, day: existing.day };
      await this.repository.add([{ activity: outcome.activity, bytes }]);
      return { fileName, status: "added", rideId: summary.id, day: summary.day };
    } catch {
      return { fileName, status: "error", errorCode: "unknown" };
    }
  }

  private parse(request: ParseRequest): Promise<ParseOutcome> {
    const worker = this.worker!;
    return new Promise((resolve) => {
      worker.onmessage = (e: MessageEvent<ParseOutcome>) => resolve(e.data);
      worker.onerror = () => resolve({ ok: false, code: "unknown" });
      worker.postMessage(request, [request.bytes]);
    });
  }

  private setResult(index: number, result: ImportResult): void {
    this.results = this.results.map((r, i) => (i === index ? result : r));
    this.emit("progress", this.progress);
  }
}
