const DB_NAME = "replay-lab-pro.snapshots";
const DB_VERSION = 1;
const STORE_NAME = "images";

export interface StoredSnapshot {
  id: string;
  blob: Blob;
  createdAt: number;
  kind: "before" | "after";
  sessionId: string;
  journalRecordId?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open snapshot database."));
    };

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

export async function saveSnapshot(snapshot: StoredSnapshot): Promise<void> {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.put(snapshot);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        transaction.error ??
          new Error("Failed to save chart snapshot."),
      );
    };
  });

  db.close();
}

export async function getSnapshot(
  id: string,
): Promise<StoredSnapshot | null> {
  const db = await openDatabase();

  const result = await new Promise<StoredSnapshot | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve((request.result as StoredSnapshot | undefined) ?? null);
    };

    request.onerror = () => {
      reject(
        request.error ??
          new Error("Failed to read chart snapshot."),
      );
    };
  });

  db.close();
  return result;
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        transaction.error ??
          new Error("Failed to delete chart snapshot."),
      );
    };
  });

  db.close();
}

export async function snapshotExists(id: string): Promise<boolean> {
  const db = await openDatabase();

  const exists = await new Promise<boolean>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count(id);

    request.onsuccess = () => resolve(request.result > 0);

    request.onerror = () => {
      reject(
        request.error ??
          new Error("Failed to check chart snapshot."),
      );
    };
  });

  db.close();
  return exists;
}
