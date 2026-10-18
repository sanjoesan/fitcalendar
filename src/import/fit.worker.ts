// Parses .fit files off the main thread, so the page stays responsive during an import.

import { parseFile } from "./parseFile";

export interface ParseRequest {
  readonly bytes: ArrayBuffer;
  readonly fileName: string;
  readonly importedAt: number;
}

self.onmessage = async (event: MessageEvent<ParseRequest>) => {
  const { bytes, fileName, importedAt } = event.data;
  self.postMessage(await parseFile(bytes, fileName, importedAt));
};
