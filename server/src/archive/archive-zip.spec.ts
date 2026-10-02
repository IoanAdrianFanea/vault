import archiver from 'archiver';
import { createWriteStream, promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  forEachArchiveEntry,
  readArchiveManifest,
  sanitizeArchiveFileName,
  toZipEntryName,
  verifyArchive,
} from './archive-zip';
import {
  ARCHIVE_MANIFEST_NAME,
  ARCHIVE_MANIFEST_VERSION,
  type ArchiveManifest,
} from './archive.types';

describe('archive-zip', () => {
  it('sanitizes archive file names and strips unsafe characters and leading dots', () => {
    expect(sanitizeArchiveFileName('../../bad:name*.pdf')).toBe(
      'bad_name_.pdf',
    );
    expect(sanitizeArchiveFileName('...hidden.txt')).toBe('hidden.txt');
    expect(sanitizeArchiveFileName('')).toBe('file');
  });

  it('deduplicates entry names under files/ case-insensitively', () => {
    const used = new Set<string>();
    expect(toZipEntryName('a.pdf', used)).toBe('files/a.pdf');
    expect(toZipEntryName('A.pdf', used)).toBe('files/A (2).pdf');
    expect(toZipEntryName('a.pdf', used)).toBe('files/a (3).pdf');
  });

  it('performs zip round trip reading manifest and extracting entries', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-zip-test-'));
    const zipPath = path.join(tempDir, 'test.zip');

    try {
      const manifest: ArchiveManifest = {
        version: ARCHIVE_MANIFEST_VERSION,
        projectId: 'prj-100',
        projectName: 'Test Project',
        archivedAt: new Date().toISOString(),
        documents: [
          {
            documentId: 'doc-1',
            entryName: 'files/file1.txt',
            originalFilename: 'file1.txt',
            mimeType: 'text/plain',
            sizeBytes: 11,
            missing: false,
          },
          {
            documentId: 'doc-2',
            entryName: 'files/file2.txt',
            originalFilename: 'file2.txt',
            mimeType: 'text/plain',
            sizeBytes: 12,
            missing: false,
          },
        ],
      };

      const out = createWriteStream(zipPath);
      const archive = archiver('zip');
      archive.pipe(out);
      archive.append(Buffer.from('hello doc 1'), { name: 'files/file1.txt' });
      archive.append(Buffer.from('hello doc 2!'), { name: 'files/file2.txt' });
      archive.append(Buffer.from(JSON.stringify(manifest)), {
        name: ARCHIVE_MANIFEST_NAME,
      });

      await new Promise<void>((resolve, reject) => {
        out.on('close', () => resolve());
        archive.on('error', (err) => reject(err));
        void archive.finalize();
      });

      const { manifest: readManifest, entrySizes } =
        await readArchiveManifest(zipPath);
      expect(readManifest.projectId).toBe('prj-100');
      expect(readManifest.documents).toHaveLength(2);
      expect(entrySizes.get('files/file1.txt')).toBe(11);

      verifyArchive(readManifest, entrySizes, 'prj-100');

      const extracted = new Map<string, string>();
      await forEachArchiveEntry(
        zipPath,
        new Set(['files/file1.txt']),
        (name, content) => {
          extracted.set(name, content.toString('utf8'));
          return Promise.resolve();
        },
      );

      expect(extracted.size).toBe(1);
      expect(extracted.get('files/file1.txt')).toBe('hello doc 1');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('verifyArchive throws on size mismatch or project id mismatch', () => {
    const manifest: ArchiveManifest = {
      version: ARCHIVE_MANIFEST_VERSION,
      projectId: 'prj-1',
      projectName: 'Test',
      archivedAt: new Date().toISOString(),
      documents: [
        {
          documentId: 'd1',
          entryName: 'files/a.txt',
          originalFilename: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          missing: false,
        },
        {
          documentId: 'd2',
          entryName: null,
          originalFilename: 'b.txt',
          mimeType: 'text/plain',
          sizeBytes: 20,
          missing: true,
        },
      ],
    };

    expect(() =>
      verifyArchive(manifest, new Map([['files/a.txt', 10]]), 'wrong-prj'),
    ).toThrow('Archive belongs to a different project');

    expect(() =>
      verifyArchive(manifest, new Map([['files/a.txt', 999]]), 'prj-1'),
    ).toThrow('Archive verification failed for document d1');

    // Should succeed when size matches and ignore missing: true
    expect(() =>
      verifyArchive(manifest, new Map([['files/a.txt', 10]]), 'prj-1'),
    ).not.toThrow();
  });
});
