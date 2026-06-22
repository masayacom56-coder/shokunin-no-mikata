"use client";

const DB_NAME = "shokunin-no-mikata";
const STORE = "sync_queue";

export type SyncRecord<T> = {
  id: string;
  type: "estimate" | "customer" | "project" | "photo";
  payload: T;
  createdAt: string;
  synced: boolean;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

export async function saveOffline<T>(record: SyncRecord<T>) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("[OfflineStore] save_failed", error);
  }
}

export async function listPending() {
  try {
    const db = await openDb();
    return await new Promise<SyncRecord<unknown>[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve((Array.isArray(request.result) ? request.result : []).filter((item) => !item.synced));
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[OfflineStore] list_pending_failed", error);
    return [];
  }
}

export async function markSynced(id: string) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const item = await new Promise<SyncRecord<unknown> | undefined>((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });
    if (item) store.put({ ...item, synced: true });
  } catch (error) {
    console.error("[OfflineStore] mark_synced_failed", error);
  }
}
