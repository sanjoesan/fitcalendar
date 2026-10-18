// One .fit file → one Activity, or the reason why not. Used by the import worker and nowhere else.

import { decodeFit, FitError, type FitErrorCode } from "../fit/FitDecoder";
import { readActivity } from "../fit/readActivity";
import { summarize } from "../model/summarize";
import type { Activity } from "../model/types";

export type ParseOutcome =
  | { readonly ok: true; readonly activity: Activity }
  | { readonly ok: false; readonly code: FitErrorCode | "unknown" };

/** The ride's id: the start of the SHA-256 of its bytes - the same file always gets the same id. */
export async function fileId(bytes: ArrayBuffer): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash.subarray(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function parseFile(bytes: ArrayBuffer, fileName: string, importedAt: number): Promise<ParseOutcome> {
  try {
    const parsed = readActivity(decodeFit(new Uint8Array(bytes)));
    return { ok: true, activity: summarize(parsed, { id: await fileId(bytes), fileName, importedAt }) };
  } catch (e) {
    return { ok: false, code: e instanceof FitError ? e.code : "unknown" };
  }
}
