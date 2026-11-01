/*
In-memory hand-off for photos taken from the documents list on a phone. The
documents page stores them and opens /upload, which reads them on mount and
then clears the store. Files can't go through router state, and nothing here is
persisted.
*/


let pendingFiles: File[] = [];

export function setPendingUploads(files: File[]): void {
  pendingFiles = [...files];
}

export function peekPendingUploads(): File[] {
  return pendingFiles;
}

export function clearPendingUploads(): void {
  pendingFiles = [];
}
