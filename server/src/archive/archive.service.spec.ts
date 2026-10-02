/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArchiveOperation } from '@prisma/client';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { ArchiveService } from './archive.service';
import type { BlobStore, SavedBlob } from '../storage/blob-store.interface';
import type { PrismaService } from '../prisma/prisma.service';

class FakeBlobStore implements BlobStore {
  files = new Map<string, Buffer>();

  async saveFile(
    projectId: string,
    documentId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<SavedBlob> {
    const ext = mimeType === 'application/pdf' ? '.pdf' : '.jpg';
    const key = `active/${projectId}/${documentId}${ext}`;
    this.files.set(key, buffer);
    return {
      storageKey: key,
      storedSizeBytes: buffer.length,
      compressed: false,
    };
  }

  async readFile(storageKey: string): Promise<Buffer> {
    const data = this.files.get(storageKey);
    if (!data) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return data;
  }

  createReadStream(storageKey: string): Readable {
    const data = this.files.get(storageKey);
    if (!data) {
      const s = new Readable({
        read() {
          this.destroy(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
        },
      });
      return s;
    }
    return Readable.from(data);
  }

  async writeStream(storageKey: string, source: Readable): Promise<number> {
    const chunks: Buffer[] = [];
    for await (const chunk of source) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks);
    this.files.set(storageKey, buf);
    return buf.length;
  }

  async withLocalFile<T>(
    storageKey: string,
    fn: (localPath: string) => Promise<T>,
  ): Promise<T> {
    const data = this.files.get(storageKey);
    if (!data)
      throw new Error(`File ${storageKey} not found in fake blob store`);
    const tempFile = path.join(
      os.tmpdir(),
      `fake-file-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
    );
    await fs.writeFile(tempFile, data);
    try {
      return await fn(tempFile);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    return this.files.has(storageKey);
  }

  async getSize(storageKey: string): Promise<number> {
    const data = this.files.get(storageKey);
    return data ? data.length : 0;
  }

  async moveFile(fromKey: string, toKey: string): Promise<void> {
    const data = this.files.get(fromKey);
    if (data) {
      this.files.set(toKey, data);
      this.files.delete(fromKey);
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    this.files.delete(storageKey);
  }
}

describe('ArchiveService', () => {
  let service: ArchiveService;
  let fakeBlobStore: FakeBlobStore;
  let mockPrisma: any;

  beforeEach(() => {
    fakeBlobStore = new FakeBlobStore();
    mockPrisma = {
      project: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      document: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      deletionLog: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn((callbackOrArray) => {
        if (typeof callbackOrArray === 'function') {
          return callbackOrArray(mockPrisma);
        }
        return Promise.all(callbackOrArray);
      }),
    };

    service = new ArchiveService(mockPrisma as PrismaService, fakeBlobStore);
  });

  it('archives active project and deletes active blobs on happy path', async () => {
    const projectId = 'p1';
    const actorId = 'u1';

    mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'admin@vault.test' });
    mockPrisma.project.findUnique.mockResolvedValue({
      name: 'Commercial Tower',
    });

    fakeBlobStore.files.set('active/p1/d1.pdf', Buffer.from('PDF content'));
    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: 'd1',
        storageKey: 'active/p1/d1.pdf',
        originalFilename: 'Tower Plan.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 11,
      },
    ]);

    const result = await service.archiveProject(projectId, actorId);

    expect(result.id).toBe(projectId);
    expect(result.missingDocuments).toHaveLength(0);
    expect(fakeBlobStore.files.has('archived/p1.zip')).toBe(true);
    expect(fakeBlobStore.files.has('active/p1/d1.pdf')).toBe(false);

    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectId },
        data: expect.objectContaining({
          archivedById: actorId,
          archivedByEmail: 'admin@vault.test',
        }),
      }),
    );
  });

  it('records missing files in manifest and returns warning without failing archive', async () => {
    const projectId = 'p1';
    mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'admin@vault.test' });
    mockPrisma.project.findUnique.mockResolvedValue({ name: 'Tower' });

    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: 'd-missing',
        storageKey: 'active/p1/missing.pdf',
        originalFilename: 'Missing.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 50,
      },
    ]);

    const result = await service.archiveProject(projectId, 'u1');

    expect(result.missingDocuments).toHaveLength(1);
    expect(result.missingDocuments[0].originalFilename).toBe('Missing.pdf');
    expect(fakeBlobStore.files.has('archived/p1.zip')).toBe(true);
  });

  it('throws ConflictException on already archived project and NotFoundException on missing project', async () => {
    mockPrisma.project.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      deletedAt: null,
      archivedAt: new Date(),
      archiveOperation: null,
    });

    await expect(service.archiveProject('p1', 'u1')).rejects.toThrow(
      ConflictException,
    );

    mockPrisma.project.findUnique.mockResolvedValue(null);
    await expect(service.archiveProject('p1', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ConflictException and cleans up temp zip if project changes during archiving', async () => {
    mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'admin@vault.test' });
    mockPrisma.project.findUnique.mockResolvedValue({ name: 'Tower' });

    fakeBlobStore.files.set('active/p1/d1.pdf', Buffer.from('PDF content'));
    mockPrisma.document.findMany
      .mockResolvedValueOnce([
        {
          id: 'd1',
          storageKey: 'active/p1/d1.pdf',
          originalFilename: 'Plan.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 11,
        },
      ])
      // In transaction: different document set
      .mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2_new' }]);

    await expect(service.archiveProject('p1', 'u1')).rejects.toThrow(
      ConflictException,
    );

    expect(fakeBlobStore.files.has('archived/p1.zip')).toBe(false);
    expect(fakeBlobStore.files.has('active/p1/d1.pdf')).toBe(true);
  });

  it('unarchives project and extracts files byte-identically', async () => {
    const projectId = 'p1';
    mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'admin@vault.test' });
    mockPrisma.project.findUnique.mockResolvedValue({ name: 'Tower' });

    // First archive to create zip in fake store
    fakeBlobStore.files.set(
      'active/p1/d1.pdf',
      Buffer.from('Original content'),
    );
    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: 'd1',
        storageKey: 'active/p1/d1.pdf',
        originalFilename: 'Plan.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 16,
      },
    ]);

    await service.archiveProject(projectId, 'u1');
    expect(fakeBlobStore.files.has('archived/p1.zip')).toBe(true);

    // Now unarchive
    mockPrisma.document.findMany.mockResolvedValue([
      { id: 'd1', mimeType: 'application/pdf' },
    ]);

    const result = await service.unarchiveProject(projectId, 'u1');
    expect(result.restoredDocuments).toBe(1);
    expect(fakeBlobStore.files.has('archived/p1.zip')).toBe(false);
    expect(fakeBlobStore.files.has('active/p1/d1.pdf')).toBe(true);
    expect(fakeBlobStore.files.get('active/p1/d1.pdf')?.toString('utf8')).toBe(
      'Original content',
    );
  });

  it('deleteArchivedProject moves zip to deleted area and creates deletion logs', async () => {
    const projectId = 'p1';
    mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'admin@vault.test' });
    mockPrisma.project.findUnique.mockResolvedValue({ name: 'Tower' });

    fakeBlobStore.files.set('archived/p1.zip', Buffer.from('ZIP DATA'));
    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: 'd1',
        originalFilename: 'Plan.pdf',
        storageKey: 'active/p1/d1.pdf',
      },
    ]);

    const result = await service.deleteArchivedProject(projectId, 'u1');
    expect(result.id).toBe(projectId);
    expect(fakeBlobStore.files.has('archived/p1.zip')).toBe(false);
    expect(fakeBlobStore.files.has('deleted/p1/archive.zip')).toBe(true);
    expect(mockPrisma.deletionLog.createMany).toHaveBeenCalled();
  });

  it('recovers interrupted operations across branches', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      {
        id: 'p-archiving-unflipped',
        archiveOperation: ArchiveOperation.ARCHIVING,
        archivedAt: null,
      },
      {
        id: 'p-archiving-flipped',
        archiveOperation: ArchiveOperation.ARCHIVING,
        archivedAt: new Date(),
      },
      {
        id: 'p-unarchiving-unflipped',
        archiveOperation: ArchiveOperation.UNARCHIVING,
        archivedAt: new Date(),
      },
      {
        id: 'p-unarchiving-flipped',
        archiveOperation: ArchiveOperation.UNARCHIVING,
        archivedAt: null,
      },
      {
        id: 'p-deleting',
        archiveOperation: ArchiveOperation.DELETING,
        deletedAt: null,
      },
    ]);

    mockPrisma.document.findMany.mockResolvedValue([]);
    fakeBlobStore.files.set(
      'archived/p-archiving-unflipped.zip.partial',
      Buffer.from(''),
    );
    fakeBlobStore.files.set(
      'archived/p-unarchiving-flipped.zip',
      Buffer.from(''),
    );
    fakeBlobStore.files.set('deleted/p-deleting/archive.zip', Buffer.from(''));

    await service.recoverInterruptedOperations();

    expect(
      fakeBlobStore.files.has('archived/p-archiving-unflipped.zip.partial'),
    ).toBe(false);
    expect(fakeBlobStore.files.has('archived/p-unarchiving-flipped.zip')).toBe(
      false,
    );
    expect(fakeBlobStore.files.has('archived/p-deleting.zip')).toBe(true);
  });
});
