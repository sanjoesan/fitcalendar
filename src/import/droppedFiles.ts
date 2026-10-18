// The files of a drop, with dropped folders read recursively (e.g. a whole Zwift "Activities" folder).

export async function droppedFiles(transfer: DataTransfer): Promise<File[]> {
  // Entries must be taken synchronously, before the first await: the browser empties the transfer after the event.
  const entries = [...transfer.items].map((item) => item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  if (entries.length === 0) return [...transfer.files];
  const files: File[] = [];
  for (const entry of entries) await collect(entry, files);
  return files;
}

async function collect(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    out.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries returns the folder in batches until an empty one.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    for (const child of batch) await collect(child, out);
  }
}
