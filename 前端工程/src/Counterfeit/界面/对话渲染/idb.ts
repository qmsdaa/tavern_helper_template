const IDB_NAME = 'CounterfeitBubbleAvatars';
const IDB_STORE = 'uploads';
const LS_URL_KEY = 'cf_bubble_custom_urls_v1';

export function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(name: string, blob: Blob) {
  const db = await idbOpen();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(name: string) {
  const db = await idbOpen();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function loadCustomUrls(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_URL_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

export function saveCustomUrls(map: Record<string, string>) {
  try {
    localStorage.setItem(LS_URL_KEY, JSON.stringify(map));
  } catch (_) {}
}
