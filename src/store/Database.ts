// The browser database (IndexedDB): opening, upgrading and promise wrappers. Knows stores, not rides.

const NAME = "fitcalendar";
const VERSION = 1;

export const STORES = {
  summaries: "summaries",
  streams: "streams",
  files: "files",
  settings: "settings",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export class Database {
  private constructor(private readonly db: IDBDatabase) {}

  static open(): Promise<Database> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of [STORES.summaries, STORES.streams, STORES.files]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings);
      };
      request.onsuccess = () => resolve(new Database(request.result));
      request.onerror = () => reject(request.error);
    });
  }

  getAll<T>(store: StoreName): Promise<T[]> {
    return this.request<T[]>(store, "readonly", (s) => s.getAll());
  }

  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return this.request<T | undefined>(store, "readonly", (s) => s.get(key));
  }

  /** Writes several stores in one transaction: either all records land or none. */
  put(records: readonly { store: StoreName; value: unknown; key?: IDBValidKey }[]): Promise<void> {
    return this.transaction(records.map((r) => r.store), (tx) => {
      for (const r of records) {
        const s = tx.objectStore(r.store);
        if (r.key === undefined) s.put(r.value);
        else s.put(r.value, r.key);
      }
    });
  }

  delete(stores: readonly StoreName[], key: IDBValidKey): Promise<void> {
    return this.transaction(stores, (tx) => {
      for (const name of stores) tx.objectStore(name).delete(key);
    });
  }

  private request<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = run(this.db.transaction(store, mode).objectStore(store));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }

  private transaction(stores: readonly StoreName[], run: (tx: IDBTransaction) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([...new Set(stores)], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      run(tx);
    });
  }
}
