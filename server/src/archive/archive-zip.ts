import yauzl, { type Entry } from 'yauzl';
import {
  ARCHIVE_FILES_DIR,
  ARCHIVE_MANIFEST_NAME,
  ARCHIVE_MANIFEST_VERSION,
  type ArchiveManifest,
} from './archive.types';

/**
 * Sanitizes a filename for inclusion in an archive zip.
 * Replaces illegal characters with '_', collapses whitespace, strips leading dots/spaces,
 * and caps length at 180 characters while preserving the extension.
 */
export function sanitizeArchiveFileName(name: string): string {
  if (!name) {
    return 'file';
  }

  // Strip directory paths and path traversal segments
  const segments = name
    .split(/[/\\/]/)
    .filter((s) => s.trim().length > 0 && s !== '..' && s !== '.');
  const baseOnly = segments.length > 0 ? segments[segments.length - 1] : '';

  /* eslint-disable-next-line no-control-regex */
  let sanitized = baseOnly.replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_');
  sanitized = sanitized.replace(/\s+/g, ' ');
  sanitized = sanitized.replace(/^[.\s]+/, '');

  if (!sanitized) {
    return 'file';
  }

  if (sanitized.length > 180) {
    const extIndex = sanitized.lastIndexOf('.');
    if (extIndex > 0 && sanitized.length - extIndex <= 20) {
      const ext = sanitized.slice(extIndex);
      const base = sanitized.slice(0, 180 - ext.length);
      sanitized = base + ext;
    } else {
      sanitized = sanitized.slice(0, 180);
    }
  }

  return sanitized || 'file';
}

/**
 * Generates a deduplicated zip entry name under files/.
 */
export function toZipEntryName(
  originalFilename: string,
  usedNames: Set<string>,
): string {
  const base = sanitizeArchiveFileName(originalFilename);
  const extIndex = base.lastIndexOf('.');
  const namePart = extIndex > 0 ? base.slice(0, extIndex) : base;
  const extPart = extIndex > 0 ? base.slice(extIndex) : '';

  let candidate = base;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${namePart} (${counter})${extPart}`;
    counter++;
  }

  usedNames.add(candidate.toLowerCase());
  return `${ARCHIVE_FILES_DIR}${candidate}`;
}

/**
 * Checks if the file format is already compressed and should be stored without deflate in the zip.
 */
export function isStoredWithoutDeflate(mimeType: string): boolean {
  return mimeType === 'image/jpeg' || mimeType === 'image/png';
}

/**
 * Reads and parses the manifest.json from an archive zip file, and records all entry sizes.
 */
export function readArchiveManifest(
  localZipPath: string,
): Promise<{ manifest: ArchiveManifest; entrySizes: Map<string, number> }> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      localZipPath,
      { lazyEntries: true, autoClose: true },
      (err, zipfile) => {
        if (err || !zipfile) {
          return reject(err || new Error('Failed to open zip file'));
        }

        const entrySizes = new Map<string, number>();
        let manifestBuffer: Buffer | null = null;

        zipfile.on('error', (zipErr) =>
          reject(zipErr instanceof Error ? zipErr : new Error(String(zipErr))),
        );

        zipfile.on('entry', (entry: Entry) => {
          entrySizes.set(entry.fileName, entry.uncompressedSize);

          if (entry.fileName === ARCHIVE_MANIFEST_NAME) {
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                return reject(
                  streamErr || new Error('Failed to read manifest stream'),
                );
              }

              const chunks: Buffer[] = [];
              readStream.on('data', (chunk) =>
                chunks.push(
                  Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
                ),
              );
              readStream.on('error', (readErr) => reject(readErr));
              readStream.on('end', () => {
                manifestBuffer = Buffer.concat(chunks);
                zipfile.readEntry();
              });
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          if (!manifestBuffer) {
            return reject(new Error('Archive manifest missing'));
          }

          try {
            const parsed = JSON.parse(
              manifestBuffer.toString('utf8'),
            ) as ArchiveManifest;
            if (parsed.version !== ARCHIVE_MANIFEST_VERSION) {
              return reject(new Error('Unsupported archive manifest version'));
            }
            resolve({ manifest: parsed, entrySizes });
          } catch (parseErr) {
            reject(
              parseErr instanceof Error
                ? parseErr
                : new Error(String(parseErr)),
            );
          }
        });

        zipfile.readEntry();
      },
    );
  });
}

/**
 * Iterates through matching entries in an archive zip file, calling handler for each.
 */
export function forEachArchiveEntry(
  localZipPath: string,
  entryNames: Set<string>,
  handler: (entryName: string, content: Buffer) => Promise<void>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      localZipPath,
      { lazyEntries: true, autoClose: true },
      (err, zipfile) => {
        if (err || !zipfile) {
          return reject(err || new Error('Failed to open zip file'));
        }

        let rejected = false;
        const fail = (error: unknown) => {
          if (!rejected) {
            rejected = true;
            try {
              zipfile.close();
            } catch {
              /* empty */
            }
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };

        zipfile.on('error', fail);

        zipfile.on('entry', (entry: Entry) => {
          if (entryNames.has(entry.fileName)) {
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                return fail(
                  streamErr ||
                    new Error(`Failed to read entry ${entry.fileName}`),
                );
              }

              const chunks: Buffer[] = [];
              readStream.on('data', (chunk) =>
                chunks.push(
                  Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
                ),
              );
              readStream.on('error', fail);
              readStream.on('end', () => {
                void (async () => {
                  try {
                    const content = Buffer.concat(chunks);
                    await handler(entry.fileName, content);
                    if (!rejected) {
                      zipfile.readEntry();
                    }
                  } catch (handlerErr) {
                    fail(handlerErr);
                  }
                })();
              });
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          if (!rejected) {
            resolve();
          }
        });

        zipfile.readEntry();
      },
    );
  });
}

/**
 * Validates that an archive zip matches the manifest and the expected project ID.
 */
export function verifyArchive(
  manifest: ArchiveManifest,
  entrySizes: Map<string, number>,
  expectedProjectId: string,
): void {
  if (manifest.projectId !== expectedProjectId) {
    throw new Error('Archive belongs to a different project');
  }

  for (const entry of manifest.documents) {
    if (!entry.missing) {
      if (!entry.entryName) {
        throw new Error(
          `Archive verification failed for document ${entry.documentId}`,
        );
      }
      const actualSize = entrySizes.get(entry.entryName);
      if (actualSize === undefined || actualSize !== entry.sizeBytes) {
        throw new Error(
          `Archive verification failed for document ${entry.documentId}`,
        );
      }
    }
  }
}
