import { RecycleBinService } from './recycle-bin.service';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('RecycleBinService', () => {
  const projectDeletedAt = new Date(Date.now() - 2 * DAY_MS);
  const earlierDeletedAt = new Date(Date.now() - 5 * DAY_MS);

  let prisma: any;
  let blobStore: any;
  let service: RecycleBinService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN' }) },
      document: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      deletionLog: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      project: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    blobStore = {
      moveFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    service = new RecycleBinService(prisma, blobStore);
  });

  const deletedDoc = (
    id: string,
    deletedAt: Date,
    project: {
      name: string;
      deletedAt: Date | null;
      archivedAt: Date | null;
    },
  ) => ({
    id,
    originalFilename: `${id}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 100,
    deletedAt,
    projectId: `project-of-${id}`,
    project,
  });

  describe('listDeletedDocuments', () => {
    it('lists documents deleted with their project, flagged as project deleted', async () => {
      prisma.document.findMany.mockResolvedValue([
        deletedDoc('with-project', projectDeletedAt, {
          name: 'Gone',
          deletedAt: projectDeletedAt,
          archivedAt: null,
        }),
        deletedDoc('own-delete', earlierDeletedAt, {
          name: 'Gone',
          deletedAt: projectDeletedAt,
          archivedAt: null,
        }),
        deletedDoc('plain', earlierDeletedAt, {
          name: 'Live',
          deletedAt: null,
          archivedAt: null,
        }),
      ]);

      const result = await service.listDeletedDocuments('admin-1');

      expect(prisma.document.findMany.mock.calls[0][0].where).toEqual({
        deletedAt: { not: null },
      });
      expect(result.map((d) => d.id)).toEqual([
        'with-project',
        'own-delete',
        'plain',
      ]);

      const byId = Object.fromEntries(result.map((d) => [d.id, d]));
      expect(byId['with-project']).toMatchObject({
        projectDeleted: true,
        restorable: true,
        requiresProjectChoice: true,
      });
      expect(byId['plain']).toMatchObject({
        projectDeleted: false,
        restorable: true,
        requiresProjectChoice: false,
      });
    });

    it('counts expiry from the document deletion date', async () => {
      prisma.document.findMany.mockResolvedValue([
        deletedDoc('with-project', projectDeletedAt, {
          name: 'Gone',
          deletedAt: projectDeletedAt,
          archivedAt: null,
        }),
      ]);

      const [doc] = await service.listDeletedDocuments('admin-1');

      expect(doc.daysRemaining).toBe(28);
    });

    it('leaves out documents that only exist inside a deleted archived project', async () => {
      prisma.document.findMany.mockResolvedValue([
        deletedDoc('in-zip', projectDeletedAt, {
          name: 'Archived',
          deletedAt: projectDeletedAt,
          archivedAt: new Date(Date.now() - 10 * DAY_MS),
        }),
        deletedDoc('deleted-earlier', earlierDeletedAt, {
          name: 'Archived',
          deletedAt: projectDeletedAt,
          archivedAt: new Date(Date.now() - 10 * DAY_MS),
        }),
      ]);

      const result = await service.listDeletedDocuments('admin-1');

      expect(result.map((d) => d.id)).toEqual(['deleted-earlier']);
    });

    it('still shows zip-backed documents when drilling into the project', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.document.findMany.mockResolvedValue([
        deletedDoc('in-zip', projectDeletedAt, {
          name: 'Archived',
          deletedAt: projectDeletedAt,
          archivedAt: new Date(Date.now() - 10 * DAY_MS),
        }),
      ]);

      const result = await service.listDeletedProjectDocuments('admin-1', 'p1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'in-zip', restorable: false });
    });
  });

  describe('restoreProject', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({
        id: 'p1',
        deletedAt: projectDeletedAt,
        deletedById: 'admin-1',
        deletedByEmail: 'admin@example.com',
        archivedAt: null,
      });
    });

    it('only looks for documents still deleted with the project', async () => {
      prisma.document.findMany.mockResolvedValue([
        { id: 'd1', storageKey: 'deleted/p1/d1.pdf' },
      ]);

      const result = await service.restoreProject('p1', 'admin-1');

      expect(prisma.document.findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', deletedAt: projectDeletedAt },
        select: { id: true, storageKey: true },
      });
      expect(result).toEqual({
        id: 'p1',
        restoredDocuments: 1,
        restoredTo: 'ACTIVE',
      });
    });

    it('skips a document that was restored or deleted in the meantime without failing', async () => {
      prisma.document.findMany.mockResolvedValue([
        { id: 'gone', storageKey: 'deleted/p1/gone.pdf' },
        { id: 'still-here', storageKey: 'deleted/p1/still-here.pdf' },
      ]);
      prisma.document.updateMany.mockImplementation(({ where }: any) =>
        Promise.resolve({ count: where.id === 'gone' ? 0 : 1 }),
      );

      const result = await service.restoreProject('p1', 'admin-1');

      expect(result.restoredDocuments).toBe(1);
      expect(blobStore.moveFile).toHaveBeenCalledTimes(1);
      expect(blobStore.moveFile).toHaveBeenCalledWith(
        'deleted/p1/still-here.pdf',
        'active/p1/still-here.pdf',
      );
    });
  });

  describe('permanentlyDeleteDocument', () => {
    it('deletes a document that was deleted with its project', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 'd1',
        storageKey: 'deleted/p1/d1.pdf',
      });

      await service.permanentlyDeleteDocument('d1', 'admin-1');

      expect(prisma.document.deleteMany).toHaveBeenCalled();
      expect(blobStore.deleteFile).toHaveBeenCalledWith('deleted/p1/d1.pdf');
    });
  });
});
