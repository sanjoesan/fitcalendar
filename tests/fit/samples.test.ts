// Runs the parser over the real .fit files on this machine, when they are there (they are not in git).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeFit, FitError } from "../../src/fit/FitDecoder";
import { readActivity } from "../../src/fit/readActivity";
import { summarize } from "../../src/model/summarize";

const ROOTS = [
  "E:/RoadbikeMinecraftmod/companion/activities",
  "E:/TuscanyReal/godot/results",
  `${process.env.USERPROFILE ?? ""}/Documents/Zwift/Activities`,
];

/** Smaller than this, a file cannot hold a ride. */
const STUB_BYTES = 4096;

function fitFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) fitFiles(path, out);
    else if (/\.fit$/i.test(name) && name !== "inProgressActivity.fit") out.push(path); // Zwift's file of a ride still going
  }
  return out;
}

const files = ROOTS.filter(existsSync).flatMap((r) => fitFiles(r));

describe.skipIf(files.length === 0)("local sample files", () => {
  it(`parses all ${files.length} files into sensible activities`, () => {
    const failures: string[] = [];
    for (const path of files) {
      try {
        const parsed = readActivity(decodeFit(new Uint8Array(readFileSync(path))));
        const { summary, streams } = summarize(parsed, { id: "x", fileName: path.split(/[\\/]/).pop()!, importedAt: 0 });
        if (!(summary.distance >= 0) || !(summary.elapsedTime > 0) || streams.time.length < 2) failures.push(`${path}: odd totals`);
      } catch (e) {
        // Stubs of recordings that were never finished (a few hundred bytes) must fail - with the right reason.
        const stub = statSync(path).size < STUB_BYTES && e instanceof FitError && (e.code === "truncated" || e.code === "no_records");
        if (!stub) failures.push(`${path}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  }, 120_000);
});
