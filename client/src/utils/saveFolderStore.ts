/*
IndexedDB storage for the chosen save folder handle, so the choice survives page
reloads. Every operation fails quietly when IndexedDB is unavailable.
*/


const DB_NAME = 'docindex';
const DB_VERSION = 1;
const STORE_NAME = 'settings';
const KEY = 'saveFolder';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  makeRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = makeRequest(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function loadSaveFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const value = await runRequest('readonly', (store) => store.get(KEY));
    return (value as FileSystemDirectoryHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function storeSaveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    await runRequest('readwrite', (store) => store.put(handle, KEY));
  } catch {
    // Storing is best effort; the folder still works until the page is reloaded.
  }
}

export async function deleteSaveFolderHandle(): Promise<void> {
  try {
    await runRequest('readwrite', (store) => store.delete(KEY));
  } catch {
    // Nothing to clean up if IndexedDB is unavailable.
  }
}
