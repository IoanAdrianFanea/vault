/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { UserRole, DocumentStatus } from '@prisma/client';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let mockPrisma: any;
  let mockExtractionService: any;
  let mockBlobStore: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      projectMembership: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      document: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      documentText: {
        upsert: jest.fn(),
      },
      documentFilterValue: {
        createMany: jest.fn(),
      },
      filterDefinition: {
        findMany: jest.fn(),
      },
    };

    mockExtractionService = {
      extractTextFromPdfBuffer: jest.fn(),
      extractTextFromImageBuffer: jest.fn(),
    };

    mockBlobStore = {
      saveFile: jest.fn().mockResolvedValue({ storageKey: 'active/proj/doc.pdf' }),
      deleteFile: jest.fn(),
    };

    service = new DocumentsService(
      mockPrisma,
      mockExtractionService,
      mockBlobStore,
    );
  });

  describe('listDocuments', () => {
    it('maps uploadedBy snapshot when relation is null, and live relation wins over snapshot', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: UserRole.ADMIN,
      });

      mockPrisma.document.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          projectId: 'p-1',
          project: { name: 'Project 1' },
          originalFilename: 'deleted-user-doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadedAt: new Date(),
          status: DocumentStatus.PROCESSED,
          errorMessage: null,
          uploadedBy: null,
          uploadedByEmail: 'gone@site.test',
        },
        {
          id: 'doc-2',
          projectId: 'p-1',
          project: { name: 'Project 1' },
          originalFilename: 'active-user-doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          uploadedAt: new Date(),
          status: DocumentStatus.PROCESSED,
          errorMessage: null,
          uploadedBy: { email: 'live@site.test' },
          uploadedByEmail: 'old-snapshot@site.test',
        },
      ]);

      const result = await service.listDocuments('admin-id', {} as any);

      expect(result).toHaveLength(2);
      expect(result[0].uploadedByEmail).toBe('gone@site.test');
      expect(result[1].uploadedByEmail).toBe('live@site.test');
    });
  });

  describe('uploadDocument', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'report.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test content'),
      size: 100,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('passes uploadedByEmail and uploadedByName to document.create', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.project.count.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.ADMIN,
        email: 'uploader@test.local',
        fullName: '  Alice Uploader  ',
      });
      mockPrisma.document.create.mockResolvedValue({ id: 'doc-1' });
      mockExtractionService.extractTextFromPdfBuffer.mockResolvedValue({
        text: 'some extracted text',
        pageCount: 1,
      });

      await service.uploadDocument('user-1', mockFile, 'proj-1');

      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          uploadedById: 'user-1',
          uploadedByEmail: 'uploader@test.local',
          uploadedByName: 'Alice Uploader',
        }),
      });
    });

    it('updates document with FAILED status and user-facing error message when PDF extraction fails, and rethrows', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.project.count.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.ADMIN,
        email: 'uploader@test.local',
        fullName: 'Alice',
      });
      mockPrisma.document.create.mockResolvedValue({ id: 'doc-fail-1' });
      mockExtractionService.extractTextFromPdfBuffer.mockRejectedValue(
        new Error('Corrupt PDF syntax at offset 0x42'),
      );

      await expect(
        service.uploadDocument('user-1', mockFile, 'proj-1'),
      ).rejects.toThrow('Corrupt PDF syntax at offset 0x42');

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-fail-1' },
        data: {
          status: DocumentStatus.FAILED,
          errorMessage: "Couldn't read text from this file.",
        },
      });
    });
  });
});
