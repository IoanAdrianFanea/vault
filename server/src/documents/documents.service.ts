import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExtractionService } from './extraction.service';
import { BLOB_STORE, type BlobStore } from '../storage/blob-store.interface';
import {
  DocumentStatus,
  UserRole,
  type FilterDefinition,
  type Prisma,
} from '@prisma/client';
import {
  type DocumentsSortBy,
  type ListDocumentsQueryDto,
} from './dto/list-documents-query.dto';
import {
  LIVE_PROJECT_WHERE,
  WRITABLE_PROJECT_WHERE,
} from '../projects/project-visibility';
import { deletedDocumentKey, storageFileName } from '../storage/storage-keys';
import {
  buildCustomFilterWhereClauses,
  parseQueryCustomFilters,
  parseUploadFilterValues,
  toDocumentFilterValueCreateData,
  validateFilterValues,
} from './filter-values.util';

// Documents business logic
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractionService: ExtractionService,
    @Inject(BLOB_STORE) private readonly blobStore: BlobStore,
  ) {}

  /**
   * Upload and process a document
   */
  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    projectId?: string,
    rawFilterValues?: string,
  ): Promise<{ id: string; status: DocumentStatus }> {
    let documentId: string | undefined;

    try {
      if (!projectId) {
        throw new BadRequestException('projectId is required');
      }

      // Validate custom filter values up front (before any writes) so a bad value
      // (e.g. non-numeric input for a NUMBER filter) fails cleanly with a 400.
      const filterValuesInput = parseUploadFilterValues(rawFilterValues);
      const filterDefinitions =
        Object.keys(filterValuesInput).length > 0
          ? await this.prisma.filterDefinition.findMany()
          : [];
      const typedFilterValues = validateFilterValues(
        filterDefinitions,
        filterValuesInput,
      );

      const project = await this.prisma.project.findFirst({
        where: { id: projectId, ...WRITABLE_PROJECT_WHERE },
        select: { id: true },
      });

      if (!project) {
        throw new BadRequestException('Invalid projectId');
      }

      // Upload policy: admins can upload anywhere, users only to assigned projects.
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, email: true, fullName: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== UserRole.ADMIN) {
        const membership = await this.prisma.projectMembership.findUnique({
          where: {
            userId_projectId: {
              userId,
              projectId,
            },
          },
          select: { userId: true },
        });

        if (!membership) {
          throw new ForbiddenException('You are not assigned to this project');
        }
      }

      const documentCreateData = {
        uploadedById: userId,
        uploadedByEmail: user.email,
        uploadedByName: user.fullName?.trim() || null,
        projectId,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: '',
        status: DocumentStatus.UPLOADED,
      } as Prisma.DocumentUncheckedCreateInput;

      // Create document record
      const document = await this.prisma.document.create({
        data: documentCreateData,
      });

      documentId = document.id;

      if (typedFilterValues.length > 0) {
        await this.prisma.documentFilterValue.createMany({
          data: toDocumentFilterValueCreateData(document.id, typedFilterValues),
        });
      }

      // Save file to storage
      const { storageKey } = await this.blobStore.saveFile(
        projectId,
        document.id,
        file.buffer,
        file.mimetype,
      );

      // Update document with storage key
      await this.prisma.document.update({
        where: { id: document.id },
        data: { storageKey },
      });

      const stillWritable = await this.prisma.project.count({
        where: { id: projectId, ...WRITABLE_PROJECT_WHERE },
      });
      if (stillWritable === 0) {
        await this.blobStore.deleteFile(storageKey);
        await this.prisma.document.delete({ where: { id: document.id } });
        documentId = undefined;
        throw new ConflictException(
          'This project is being archived. Please try again later.',
        );
      }

      if (file.mimetype === 'application/pdf') {
        // Set status to processing
        await this.prisma.document.update({
          where: { id: document.id },
          data: { status: DocumentStatus.PROCESSING },
        });

        // Extract text from PDF
        const { text: extractedText, pageCount } =
          await this.extractionService.extractTextFromPdfBuffer(file.buffer);

        // Save extracted text
        await this.prisma.documentText.upsert({
          where: { documentId: document.id },
          create: {
            documentId: document.id,
            extractedText,
            pageCount,
          },
          update: {
            extractedText,
            pageCount,
          },
        });
      } else if (
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/png'
      ) {
        // OCR for images (Phase 3) so they participate in full-text search.
        // A failed OCR pass must not fail the whole upload — the file itself is
        // fine, only its searchable text is unavailable — so errors are logged
        // and swallowed rather than propagated to the outer catch below.
        await this.prisma.document.update({
          where: { id: document.id },
          data: { status: DocumentStatus.PROCESSING },
        });

        try {
          const { text: extractedText } =
            await this.extractionService.extractTextFromImageBuffer(
              file.buffer,
            );

          if (extractedText.trim().length > 0) {
            await this.prisma.documentText.upsert({
              where: { documentId: document.id },
              create: { documentId: document.id, extractedText },
              update: { extractedText },
            });
          }
        } catch (ocrError) {
          this.logger.warn(
            `OCR failed for document ${document.id}: ${String(ocrError)}`,
          );
        }
      }

      // Mark as processed
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.PROCESSED },
      });

      return {
        id: document.id,
        status: DocumentStatus.PROCESSED,
      };
    } catch (error) {
      // Mark document as failed if any step fails
      if (documentId) {
        this.logger.error(
          `Processing failed for document ${documentId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        await this.prisma.document.update({
          where: { id: documentId },
          data: {
            status: DocumentStatus.FAILED,
            errorMessage:
              file.mimetype === 'application/pdf'
                ? "Couldn't read text from this file."
                : "Couldn't process this image.",
          },
        });
      }

      throw error;
    }
  }

  /**
   * Get a single document by ID
   */
  async getDocument(documentId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const allowedProjectIds = await this.getAccessibleProjectIds(
      userId,
      user.role,
    );

    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        project: LIVE_PROJECT_WHERE,
        ...(allowedProjectIds !== null && {
          projectId: { in: allowedProjectIds },
        }),
      },
      include: {
        text: {
          select: {
            extractedAt: true,
            extractedText: true,
            pageCount: true,
          },
        },
        filterValues: {
          include: {
            filterDefinition: {
              select: { id: true, name: true, type: true },
            },
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Create a preview of the extracted text (first 150 characters)
    const textPreview = document.text?.extractedText
      ? document.text.extractedText.substring(0, 150) +
        (document.text.extractedText.length > 150 ? '...' : '')
      : null;

    return {
      id: document.id,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      uploadedAt: document.uploadedAt,
      status: document.status,
      errorMessage: document.errorMessage,
      extractedAt: document.text?.extractedAt || null,
      pageCount: document.text?.pageCount || null,
      textPreview,
      filterValues: document.filterValues.map((value) => ({
        filterDefinitionId: value.filterDefinition.id,
        name: value.filterDefinition.name,
        type: value.filterDefinition.type,
        value:
          value.valueText ??
          (value.valueNumber !== null ? String(value.valueNumber) : null) ??
          (value.valueDate ? value.valueDate.toISOString() : null),
      })),
    };
  }

  /**
   * Returns project IDs the user can access.
   * Admins get null (no restriction). Regular users get their assigned project IDs.
   */
  private async getAccessibleProjectIds(
    userId: string,
    role: UserRole,
  ): Promise<string[] | null> {
    if (role === UserRole.ADMIN) return null;
    const memberships = await this.prisma.projectMembership.findMany({
      where: { userId },
      select: { projectId: true },
    });
    return memberships.map((m) => m.projectId);
  }

  /**
   * Build document filters for list and counts
   */
  private buildDocumentsWhere(
    query: ListDocumentsQueryDto,
    options: {
      includeStatus?: boolean;
      allowedProjectIds?: string[] | null;
      filterDefinitions?: FilterDefinition[];
    } = {},
  ): Prisma.DocumentWhereInput {
    const whereClauses: Prisma.DocumentWhereInput[] = [];

    // Soft-deleted documents are never visible through any read path.
    whereClauses.push({ deletedAt: null });
    whereClauses.push({ project: LIVE_PROJECT_WHERE });

    if (
      options.allowedProjectIds !== undefined &&
      options.allowedProjectIds !== null
    ) {
      whereClauses.push({ projectId: { in: options.allowedProjectIds } });
    }

    if (query.projectId) {
      whereClauses.push({ projectId: query.projectId });
    }

    const mainFilterTerm = query.mainFilter?.trim();
    if (mainFilterTerm) {
      whereClauses.push({
        OR: [
          {
            originalFilename: {
              contains: mainFilterTerm,
            },
          },
          {
            text: {
              is: {
                extractedText: {
                  contains: mainFilterTerm,
                },
              },
            },
          },
        ],
      });
    }

    // Admin-configurable custom filters (Phase 3) — one AND-clause per active filter.
    const customFilters = parseQueryCustomFilters(query.customFilters);
    if (Object.keys(customFilters).length > 0 && options.filterDefinitions) {
      whereClauses.push(
        ...buildCustomFilterWhereClauses(
          options.filterDefinitions,
          customFilters,
        ),
      );
    }

    if (options.includeStatus !== false && query.status) {
      whereClauses.push({ status: query.status });
    }

    return whereClauses.length > 0 ? { AND: whereClauses } : {};
  }

  /**
   * Fetch filter definitions only when the query actually references custom filters,
   * to avoid an unnecessary query on the (very common) unfiltered case.
   */
  private async getFilterDefinitionsIfNeeded(
    query: ListDocumentsQueryDto,
  ): Promise<FilterDefinition[]> {
    if (!query.customFilters) return [];
    return this.prisma.filterDefinition.findMany();
  }

  /**
   * List all documents with optional filters/sorting
   */
  async listDocuments(userId: string, query: ListDocumentsQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const allowedProjectIds = await this.getAccessibleProjectIds(
      userId,
      user.role,
    );
    const filterDefinitions = await this.getFilterDefinitionsIfNeeded(query);
    const where = this.buildDocumentsWhere(query, {
      allowedProjectIds,
      filterDefinitions,
    });

    const orderBy = this.getDocumentsOrderBy(query.sortBy);

    const documents = await this.prisma.document.findMany({
      where,
      orderBy,
      take: 50,
      select: {
        id: true,
        projectId: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
        status: true,
        errorMessage: true,
        uploadedByEmail: true,
        uploadedBy: {
          select: {
            email: true,
          },
        },
        project: {
          select: {
            name: true,
          },
        },
      },
    });

    return documents.map((doc) => ({
      id: doc.id,
      projectId: doc.projectId,
      projectName: doc.project.name,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      uploadedAt: doc.uploadedAt,
      status: doc.status,
      errorMessage: doc.errorMessage,
      uploadedByEmail: doc.uploadedBy?.email ?? doc.uploadedByEmail ?? null,
    }));
  }

  async getStatusCounts(userId: string, query: ListDocumentsQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const allowedProjectIds = await this.getAccessibleProjectIds(
      userId,
      user.role,
    );
    const filterDefinitions = await this.getFilterDefinitionsIfNeeded(query);
    const where = this.buildDocumentsWhere(query, {
      includeStatus: false,
      allowedProjectIds,
      filterDefinitions,
    });

    const rows = await this.prisma.document.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    const counts = {
      UPLOADED: 0,
      QUEUED: 0,
      PROCESSING: 0,
      PROCESSED: 0,
      FAILED: 0,
    } as Record<DocumentStatus, number>;

    for (const row of rows) {
      counts[row.status] = row._count.status;
    }

    return counts;
  }

  private getDocumentsOrderBy(
    sortBy?: DocumentsSortBy,
  ): Prisma.DocumentOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'upload-oldest':
        return [{ uploadedAt: 'asc' }];
      case 'name-asc':
        return [{ originalFilename: 'asc' }];
      case 'name-desc':
        return [{ originalFilename: 'desc' }];
      case 'status':
        return [{ status: 'asc' }, { uploadedAt: 'desc' }];
      case 'upload-newest':
      default:
        return [{ uploadedAt: 'desc' }];
    }
  }

  /**
   * Get extracted text for a document
   */
  async getDocumentText(documentId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const allowedProjectIds = await this.getAccessibleProjectIds(
      userId,
      user.role,
    );

    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        project: LIVE_PROJECT_WHERE,
        ...(allowedProjectIds !== null && {
          projectId: { in: allowedProjectIds },
        }),
      },
      include: {
        text: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!document.text) {
      throw new NotFoundException('No extracted text available');
    }

    return {
      documentId: document.id,
      extractedText: document.text.extractedText,
      extractedAt: document.text.extractedAt,
    };
  }

  /**
   * Search documents by filename and text content
   */
  async searchDocuments(userId: string, query: string) {
    // Return empty results for invalid queries
    if (!query || query.trim().length < 2) {
      return { results: [] };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const allowedProjectIds = await this.getAccessibleProjectIds(
      userId,
      user.role,
    );

    const lowerQuery = query.toLowerCase();

    const allDocuments = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        project: LIVE_PROJECT_WHERE,
        text: {
          isNot: null,
        },
        ...(allowedProjectIds !== null && {
          projectId: { in: allowedProjectIds },
        }),
      },
      include: {
        text: {
          select: {
            extractedText: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Filter documents that contain the query in filename or text content (case-insensitive)
    const matchingDocuments = allDocuments
      .filter((doc) => {
        const filename = doc.originalFilename.toLowerCase();
        const text = doc.text?.extractedText || '';
        const lowerText = text.toLowerCase();

        return filename.includes(lowerQuery) || lowerText.includes(lowerQuery);
      })
      .slice(0, 20); // Limit to 20 results

    // Generate snippets for each result
    const results = matchingDocuments.map((doc) => {
      const filename = doc.originalFilename.toLowerCase();
      const text = doc.text?.extractedText || '';
      const lowerText = text.toLowerCase();

      // Check if query matches in filename
      const matchesFilename = filename.includes(lowerQuery);
      const matchesText = lowerText.includes(lowerQuery);

      let snippet: string;
      if (matchesText) {
        // If query found in text, create text snippet
        snippet = this.createSnippet(text, query);
      } else if (matchesFilename) {
        // If query only found in filename, create filename snippet
        snippet = this.createFilenameSnippet(doc.originalFilename, query);
      } else {
        snippet = '...';
      }

      return {
        documentId: doc.id,
        filename: doc.originalFilename,
        snippet,
      };
    });

    return { results };
  }

  /**
   * Create a contextual snippet with highlighted match
   */
  private createSnippet(text: string, query: string): string {
    const CHARS_BEFORE = 80;
    const CHARS_AFTER = 80;

    // Normalize whitespace in text
    const normalizedText = text.replace(/\s+/g, ' ').trim();

    // Find first match (case-insensitive)
    const lowerText = normalizedText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);

    // No match found (shouldn't happen due to query, but safety check)
    if (matchIndex === -1) {
      return '...';
    }

    // Calculate snippet boundaries
    const startIndex = Math.max(0, matchIndex - CHARS_BEFORE);
    const endIndex = Math.min(
      normalizedText.length,
      matchIndex + query.length + CHARS_AFTER,
    );

    // Extract snippet
    const snippet = normalizedText.substring(startIndex, endIndex);

    // Add ellipsis if clipped
    const prefixEllipsis = startIndex > 0 ? '... ' : '';
    const suffixEllipsis = endIndex < normalizedText.length ? ' ...' : '';

    // Highlight the match with <mark> tags
    const matchStart = matchIndex - startIndex;
    const matchEnd = matchStart + query.length;
    const beforeMatch = snippet.substring(0, matchStart);
    const match = snippet.substring(matchStart, matchEnd);
    const afterMatch = snippet.substring(matchEnd);

    return `${prefixEllipsis}${beforeMatch}<mark>${match}</mark>${afterMatch}${suffixEllipsis}`;
  }

  /**
   * Create a snippet for filename matches
   */
  private createFilenameSnippet(filename: string, query: string): string {
    const lowerFilename = filename.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerFilename.indexOf(lowerQuery);

    if (matchIndex === -1) {
      return `Filename: ${filename}`;
    }

    // Highlight the match in the filename
    const beforeMatch = filename.substring(0, matchIndex);
    const match = filename.substring(matchIndex, matchIndex + query.length);
    const afterMatch = filename.substring(matchIndex + query.length);

    return `Filename: ${beforeMatch}<mark>${match}</mark>${afterMatch}`;
  }

  /**
   * Soft delete a single document.
   *
   * Admins may delete in any project; regular users may delete documents in projects
   * they are a member of. Documents outside the caller's scope report 404, consistent
   * with how out-of-scope documents are hidden everywhere else.
   *
   * The row is kept with `deletedAt` set, a DeletionLog row is written, and the file is
   * moved into the `deleted/` holding area rather than unlinked, so it can be restored.
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const allowedProjectIds = await this.getAccessibleProjectIds(
      userId,
      user.role,
    );

    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        project: WRITABLE_PROJECT_WHERE,
        ...(allowedProjectIds !== null && {
          projectId: { in: allowedProjectIds },
        }),
      },
      include: {
        project: { select: { name: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const originalStorageKey = document.storageKey;
    const deletedStorageKey = originalStorageKey
      ? deletedDocumentKey(
          document.projectId,
          storageFileName(originalStorageKey),
        )
      : '';

    if (originalStorageKey) {
      try {
        await this.blobStore.moveFile(document.storageKey, deletedStorageKey);
      } catch (error) {
        // A missing blob must not block the audit trail — log and continue.
        this.logger.warn(
          `Could not move file for document ${documentId} to the deleted area: ${String(error)}`,
        );
      }
    }

    const deletedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.document.update({
        where: { id: documentId },
        data: {
          deletedAt,
          ...(originalStorageKey && { storageKey: deletedStorageKey }),
        },
      }),
      this.prisma.deletionLog.create({
        data: {
          documentId: document.id,
          projectId: document.projectId,
          projectName: document.project.name,
          originalFilename: document.originalFilename,
          storageKey: originalStorageKey,
          actorId: userId,
          actorEmail: user.email,
          deletedAt,
        },
      }),
    ]);
  }

  /**
   * Bulk soft delete multiple documents
   */
  async bulkDeleteDocuments(
    documentIds: string[],
    userId: string,
  ): Promise<{ deleted: number; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const documentId of documentIds) {
      try {
        await this.deleteDocument(documentId, userId);
        deleted.push(documentId);
      } catch (error) {
        failed.push(documentId);
      }
    }

    return {
      deleted: deleted.length,
      failed,
    };
  }
}
