import {
  ACTIVE_PREFIX,
  ARCHIVED_PREFIX,
  DELETED_PREFIX,
  COMPRESSED_SUFFIX,
  extensionForMimeType,
  documentFileName,
  activeDocumentKey,
  deletedDocumentKey,
  archiveKey,
  archiveTempKey,
  deletedArchiveKey,
  storageFileName,
  isCompressedKey,
  isDeletedAreaKey,
  assertSafeStorageKey,
} from './storage-keys';

describe('storage-keys', () => {
  it('defines correct prefixes and suffixes', () => {
    expect(ACTIVE_PREFIX).toBe('active/');
    expect(ARCHIVED_PREFIX).toBe('archived/');
    expect(DELETED_PREFIX).toBe('deleted/');
    expect(COMPRESSED_SUFFIX).toBe('.gz');
  });

  it('builds keys in documented format', () => {
    expect(extensionForMimeType('application/pdf')).toBe('.pdf');
    expect(extensionForMimeType('image/jpeg')).toBe('.jpg');
    expect(extensionForMimeType('image/png')).toBe('.png');
    expect(() => extensionForMimeType('text/plain')).toThrow(
      'Unsupported mime type',
    );

    expect(documentFileName('doc-1', '.pdf')).toBe('doc-1.pdf');
    expect(activeDocumentKey('proj-1', 'doc-1.pdf')).toBe(
      'active/proj-1/doc-1.pdf',
    );
    expect(deletedDocumentKey('proj-1', 'doc-1.pdf')).toBe(
      'deleted/proj-1/doc-1.pdf',
    );
    expect(archiveKey('proj-1')).toBe('archived/proj-1.zip');
    expect(archiveTempKey('proj-1')).toBe('archived/proj-1.zip.partial');
    expect(deletedArchiveKey('proj-1')).toBe('deleted/proj-1/archive.zip');
  });

  it('extracts filename from storage key', () => {
    expect(storageFileName('active/p/d.pdf.gz')).toBe('d.pdf.gz');
    expect(storageFileName('active/proj-1/doc-1.pdf')).toBe('doc-1.pdf');
  });

  it('detects compressed and deleted keys', () => {
    expect(isCompressedKey('active/p/doc.pdf.gz')).toBe(true);
    expect(isCompressedKey('active/p/doc.pdf')).toBe(false);
    expect(isDeletedAreaKey('deleted/p/doc.pdf')).toBe(true);
    expect(isDeletedAreaKey('active/p/doc.pdf')).toBe(false);
  });

  it('validates storage keys for safety', () => {
    expect(() => assertSafeStorageKey('../x')).toThrow('Unsafe storage key');
    expect(() => assertSafeStorageKey('a/../b')).toThrow('Unsafe storage key');
    expect(() => assertSafeStorageKey('/abs')).toThrow('Unsafe storage key');
    expect(() => assertSafeStorageKey('a\\b')).toThrow('Unsafe storage key');
    expect(() => assertSafeStorageKey('')).toThrow('Unsafe storage key');
    expect(() => assertSafeStorageKey('a/\0/b')).toThrow('Unsafe storage key');

    expect(() =>
      assertSafeStorageKey('active/proj-1/doc-1.pdf.gz'),
    ).not.toThrow();
  });
});
