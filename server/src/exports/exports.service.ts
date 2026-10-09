/*
Reads documents out of blob storage for single-file downloads and
multi-document zip exports. Only returns non-deleted documents in live
projects the user can access.
*/


import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BlobStore } from '../storage/blob-store.interface';
import { BLOB_STORE } from '../storage/blob-store.interface';
import { UserRole } from '@prisma/client';
import archiver from 'archiver';
import { Readable } from 'stream';
import { LIVE_PROJECT_WHERE } from '../projects/project-visibility';

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(BLOB_STORE) private blobStore: BlobStore,
  ) {}

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
   * Get a single document's PDF for download
   */
  async downloadDocument(
    documentId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
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
    });

    if (!document || !document.storageKey) {
      throw new NotFoundException('Document not found');
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await this.blobStore.readFile(document.storageKey);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw err;
    }

    return {
      buffer: fileBuffer,
      filename: document.originalFilename,
      mimeType: document.mimeType,
    };
  }

  /**
   * Create a ZIP file containing multiple documents
   */
  async exportDocuments(
    documentIds: string[],
    userId: string,
  ): Promise<{ stream: Readable; filename: string }> {
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

    const documents = await this.prisma.document.findMany({
      where: {
        id: { in: documentIds },
        deletedAt: null,
        project: LIVE_PROJECT_WHERE,
        ...(allowedProjectIds !== null && {
          projectId: { in: allowedProjectIds },
        }),
      },
    });

    // Check if all requested documents were found (and accessible)
    if (documents.length !== documentIds.length) {
      throw new NotFoundException('One or more documents not found');
    }

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Add each document to the archive
    for (const document of documents) {
      try {
        if (
          document.storageKey &&
          (await this.blobStore.exists(document.storageKey))
        ) {
          archive.append(this.blobStore.createReadStream(document.storageKey), {
            name: document.originalFilename,
          });
        } else {
          this.logger.warn(
            `Storage key missing or file does not exist for document ${document.id}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to add document ${document.id} to archive: ${String(error)}`,
        );
      }
    }

    // Finalize the archive (no more files will be added)
    archive.finalize();

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `documents-export-${timestamp}.zip`;

    return {
      stream: archive,
      filename,
    };
  }
}
