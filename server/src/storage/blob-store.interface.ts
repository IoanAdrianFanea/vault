/*
The storage abstraction every service uses for file access, plus its
BLOB_STORE injection token. Keeps services independent of where files are
actually kept.
*/


import { Readable } from 'stream';

export interface SavedBlob {
  storageKey: string;
  storedSizeBytes: number;
  compressed: boolean;
}

// Storage abstraction interface
// Allows swapping between local storage and S3/cloud storage
export interface BlobStore {
  /**
   * Save a file
   */
  saveFile(
    projectId: string,
    documentId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<SavedBlob>;

  /**
   * Read file original bytes, transparently decompressing if compressed.
   */
  readFile(storageKey: string): Promise<Buffer>;

  /**
   * Stream file original bytes, transparently decompressing if compressed.
   */
  createReadStream(storageKey: string): Readable;

  /**
   * Raw write stream with no compression; resolves to the bytes written.
   */
  writeStream(storageKey: string, source: Readable): Promise<number>;

  /**
   * Execute callback with access to a temporary/local filesystem path for the storage key.
   */
  withLocalFile<T>(
    storageKey: string,
    fn: (localPath: string) => Promise<T>,
  ): Promise<T>;

  /**
   * Check if a storage key exists.
   */
  exists(storageKey: string): Promise<boolean>;

  /**
   * Get the stored (on-disk) size in bytes.
   */
  getSize(storageKey: string): Promise<number>;

  /**
   * Move a stored file to a new key (used by soft delete, restore and archiving)
   */
  moveFile(fromKey: string, toKey: string): Promise<void>;

  /**
   * Delete a file
   */
  deleteFile(storageKey: string): Promise<void>;
}

// Injection token for BlobStore
export const BLOB_STORE = Symbol('BLOB_STORE');
