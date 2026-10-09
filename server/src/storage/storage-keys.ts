/*
Single source of truth for storage key formats across the active, archived
and deleted areas, plus helpers to build, inspect and safety-check keys.
*/


export const ACTIVE_PREFIX = 'active/';
export const ARCHIVED_PREFIX = 'archived/';
export const DELETED_PREFIX = 'deleted/';
export const COMPRESSED_SUFFIX = '.gz';

/**
 * Returns the file extension for a supported mime type.
 * Throws an error for unsupported mime types.
 */
export function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return '.pdf';
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

/**
 * Formats a document file name from its id and extension.
 */
export function documentFileName(
  documentId: string,
  extension: string,
): string {
  return `${documentId}${extension}`;
}

/**
 * Returns the storage key for an active document file.
 */
export function activeDocumentKey(projectId: string, fileName: string): string {
  return `${ACTIVE_PREFIX}${projectId}/${fileName}`;
}

/**
 * Returns the storage key for a soft-deleted document file.
 */
export function deletedDocumentKey(
  projectId: string,
  fileName: string,
): string {
  return `${DELETED_PREFIX}${projectId}/${fileName}`;
}

/**
 * Returns the storage key for a project's archive zip file.
 */
export function archiveKey(projectId: string): string {
  return `${ARCHIVED_PREFIX}${projectId}.zip`;
}

/**
 * Returns the temporary storage key used while creating a project's archive zip.
 */
export function archiveTempKey(projectId: string): string {
  return `${ARCHIVED_PREFIX}${projectId}.zip.partial`;
}

/**
 * Returns the storage key for a soft-deleted project's archive zip file.
 */
export function deletedArchiveKey(projectId: string): string {
  return `${DELETED_PREFIX}${projectId}/archive.zip`;
}

/**
 * Extracts the filename (last segment after '/') from a storage key.
 */
export function storageFileName(storageKey: string): string {
  const segments = storageKey.split('/');
  return segments[segments.length - 1];
}

/**
 * Checks if the storage key refers to a gzip-compressed file.
 */
export function isCompressedKey(storageKey: string): boolean {
  return storageKey.endsWith(COMPRESSED_SUFFIX);
}

/**
 * Checks if the storage key is located within the soft-deleted area.
 */
export function isDeletedAreaKey(storageKey: string): boolean {
  return storageKey.startsWith(DELETED_PREFIX);
}

/**
 * Validates that a storage key does not contain illegal characters or path traversal.
 * Throws an Error('Unsafe storage key') if invalid.
 */
export function assertSafeStorageKey(storageKey: string): void {
  if (
    !storageKey ||
    storageKey.startsWith('/') ||
    storageKey.includes('\\') ||
    storageKey.includes('\0')
  ) {
    throw new Error('Unsafe storage key');
  }

  const segments = storageKey.split('/');
  for (const segment of segments) {
    if (segment === '..' || segment === '') {
      throw new Error('Unsafe storage key');
    }
  }
}
