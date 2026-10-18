// The files laid down for the next import - the only owner of that list. Files are collected from drops and file
// choosers until the user presses import; the same file laid down twice is kept once, files that are not .fit are
// counted and left out.

import { Emitter } from "../app/Emitter";

export interface TrayState {
  readonly files: readonly File[];
  /** Files left out since the last clear because they are not .fit files. */
  readonly skipped: number;
}

const isFit = (file: File): boolean => /\.fit$/i.test(file.name);
const keyOf = (file: File): string => `${file.name}|${file.size}|${file.lastModified}`;

export class ImportTray extends Emitter<{ changed: TrayState }> {
  private readonly files = new Map<string, File>();
  private skipped = 0;

  get state(): TrayState {
    return { files: [...this.files.values()], skipped: this.skipped };
  }

  get count(): number {
    return this.files.size;
  }

  add(files: readonly File[]): void {
    for (const file of files) {
      if (isFit(file)) this.files.set(keyOf(file), file);
      else this.skipped++;
    }
    this.emit("changed", this.state);
  }

  remove(file: File): void {
    this.files.delete(keyOf(file));
    this.emit("changed", this.state);
  }

  clear(): void {
    this.files.clear();
    this.skipped = 0;
    this.emit("changed", this.state);
  }

  /** Hands all laid-down files over (to the import) and empties the tray. */
  take(): File[] {
    const files = [...this.files.values()];
    this.clear();
    return files;
  }
}
