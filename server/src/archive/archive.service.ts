/*
Moves whole projects from active storage into a single verified zip and back,
and handles archive downloads and moving archived projects to the recycle
bin. Each operation claims the project row first, and operations interrupted
by a restart are cleaned up on startup.
*/


import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ConflictException,
  HttpException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ArchiveOperation, type Prisma } from '@prisma/client';
import archiver from 'archiver';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { BLOB_STORE, type BlobStore } from '../storage/blob-store.interface';
import {
  ACTIVE_PREFIX,
  activeDocumentKey,
  archiveKey,
  archiveTempKey,
  deletedArchiveKey,
  documentFileName,
  extensionForMimeType,
} from '../storage/storage-keys';
import {
  ARCHIVE_MANIFEST_NAME,
  ARCHIVE_MANIFEST_VERSION,
  type ArchiveManifest,
  type ArchiveManifestEntry,
  type ArchiveProjectResult,
  type ArchivedProjectSummary,
  type MissingArchiveDocument,
  type UnarchiveProjectResult,
} from './archive.types';
import {
  forEachArchiveEntry,
  isStoredWithoutDeflate,
  readArchiveManifest,
  sanitizeArchiveFileName,
  toZipEntryName,
  verifyArchive,
} from './archive-zip';

@Injectable()
export class ArchiveService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BLOB_STORE) private readonly blobStore: BlobStore,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.recoverInterruptedOperations();
    } catch (error) {
      this.logger.error(
        `Error during archive bootstrap recovery: ${String(error)}`,
      );
    }
  }

  async listArchivedProjects(): Promise<ArchivedProjectSummary[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        archivedAt: { not: null },
        deletedAt: null,
      },
      orderBy: { archivedAt: 'desc' },
      select: {
        id: true,
        name: true,
        archivedAt: true,
        archivedByEmail: true,
        archivedBy: { select: { fullName: true } },
        archiveSizeBytes: true,
        archiveOperation: true,
        _count: {
          select: {
            memberships: true,
            documents: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      archivedAt: p.archivedAt as Date,
      archivedByEmail: p.archivedByEmail,
      archivedByName: p.archivedBy?.fullName ?? null,
      archiveSizeBytes: Number(p.archiveSizeBytes ?? 0n),
      documentCount: p._count.documents,
      memberCount: p._count.memberships,
      operation: p.archiveOperation,
    }));
  }

  async archiveProject(
    projectId: string,
    actorId: string,
  ): Promise<ArchiveProjectResult> {
    const claimed = await this.claim(projectId, ArchiveOperation.ARCHIVING, {
      deletedAt: null,
      archivedAt: null,
    });

    if (!claimed) {
      await this.explainClaimFailure(projectId, 'ACTIVE');
    }

    let flipped = false;
    const tempKey = archiveTempKey(projectId);
    const finalKey = archiveKey(projectId);

    try {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { email: true },
      });
      const actorEmail = actor?.email ?? 'unknown';

      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const docs = await this.prisma.document.findMany({
        where: { projectId, deletedAt: null },
        select: {
          id: true,
          storageKey: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
        },
        orderBy: { uploadedAt: 'asc' },
      });

      const usedNames = new Set<string>();
      const manifestEntries: ArchiveManifestEntry[] = [];
      const missingDocuments: MissingArchiveDocument[] = [];
      const liveDocsWithFiles: Array<
        (typeof docs)[number] & { entryName: string }
      > = [];

      for (const doc of docs) {
        if (!doc.storageKey) {
          continue;
        }

        const fileExists = await this.blobStore.exists(doc.storageKey);
        if (fileExists) {
          const entryName = toZipEntryName(doc.originalFilename, usedNames);
          manifestEntries.push({
            documentId: doc.id,
            entryName,
            originalFilename: doc.originalFilename,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes,
            missing: false,
          });
          liveDocsWithFiles.push({ ...doc, entryName });
        } else {
          this.logger.warn(
            `Document ${doc.id} (${doc.originalFilename}) file missing from storageKey: ${doc.storageKey}`,
          );
          manifestEntries.push({
            documentId: doc.id,
            entryName: null,
            originalFilename: doc.originalFilename,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes,
            missing: true,
          });
          missingDocuments.push({
            id: doc.id,
            originalFilename: doc.originalFilename,
          });
        }
      }

      const manifest: ArchiveManifest = {
        version: ARCHIVE_MANIFEST_VERSION,
        projectId,
        projectName: project.name,
        archivedAt: new Date().toISOString(),
        documents: manifestEntries,
      };

      const zip = archiver('zip', { zlib: { level: 6 } });
      zip.on('warning', (w) =>
        this.logger.warn(`Archiver warning: ${String(w)}`),
      );

      const writtenPromise = this.blobStore.writeStream(tempKey, zip);

      for (const item of liveDocsWithFiles) {
        zip.append(this.blobStore.createReadStream(item.storageKey), {
          name: item.entryName,
          store: isStoredWithoutDeflate(item.mimeType),
        });
      }

      zip.append(Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), {
        name: ARCHIVE_MANIFEST_NAME,
      });

      await zip.finalize();
      const archiveSizeBytes = await writtenPromise;

      const { manifest: readBack, entrySizes } =
        await this.blobStore.withLocalFile(tempKey, readArchiveManifest);
      verifyArchive(readBack, entrySizes, projectId);

      await this.blobStore.moveFile(tempKey, finalKey);

      const archivedAt = new Date();

      await this.prisma.$transaction(async (tx) => {
        const current = await tx.document.findMany({
          where: { projectId, deletedAt: null },
          select: { id: true },
        });

        const currentIds = new Set(current.map((c) => c.id));
        const initialIds = new Set(docs.map((d) => d.id));
        if (
          currentIds.size !== initialIds.size ||
          [...currentIds].some((id) => !initialIds.has(id))
        ) {
          throw new ConflictException(
            'The project changed while it was being archived. Please try again.',
          );
        }

        await tx.project.update({
          where: { id: projectId },
          data: {
            archivedAt,
            archivedById: actorId,
            archivedByEmail: actorEmail,
            archiveSizeBytes: BigInt(archiveSizeBytes),
          },
        });

        flipped = true;
      });

      for (const item of liveDocsWithFiles) {
        try {
          await this.blobStore.deleteFile(item.storageKey);
        } catch (err) {
          this.logger.warn(
            `Failed to clean up active file for document ${item.id} after archive: ${String(err)}`,
          );
        }
      }

      this.logger.log(
        `Project ${projectId} archived by ${actorEmail}: ${docs.length} documents, ${missingDocuments.length} missing, ${archiveSizeBytes} bytes`,
      );

      return {
        id: projectId,
        name: project.name,
        archivedAt,
        archiveSizeBytes,
        documentCount: docs.length,
        missingDocuments,
      };
    } catch (error) {
      if (!flipped) {
        await this.blobStore.deleteFile(tempKey).catch(() => {});
        await this.blobStore.deleteFile(finalKey).catch(() => {});
      }

      if (!(error instanceof HttpException)) {
        this.logger.error(
          `Archiving project ${projectId} failed: ${String(error)}`,
        );
        throw new ConflictException(
          'Archiving failed; the project was left unchanged',
        );
      }
      throw error;
    } finally {
      await this.releaseClaim(projectId);
    }
  }

  async unarchiveProject(
    projectId: string,
    actorId: string,
  ): Promise<UnarchiveProjectResult> {
    const claimed = await this.claim(projectId, ArchiveOperation.UNARCHIVING, {
      deletedAt: null,
      archivedAt: { not: null },
    });

    if (!claimed) {
      await this.explainClaimFailure(projectId, 'ARCHIVED');
    }

    let flipped = false;
    const finalKey = archiveKey(projectId);
    const newKeys = new Map<string, string>();

    try {
      const { manifest, entrySizes } = await this.blobStore.withLocalFile(
        finalKey,
        readArchiveManifest,
      );
      verifyArchive(manifest, entrySizes, projectId);

      const docs = await this.prisma.document.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, mimeType: true },
      });
      const docsById = new Map(docs.map((d) => [d.id, d]));

      const toRestore = manifest.documents.filter(
        (e) => !e.missing && e.entryName && docsById.has(e.documentId),
      );
      const byName = new Map(toRestore.map((e) => [e.entryName!, e]));
      const names = new Set(byName.keys());

      await this.blobStore.withLocalFile(finalKey, (localPath) =>
        forEachArchiveEntry(localPath, names, async (name, content) => {
          const entry = byName.get(name)!;
          const doc = docsById.get(entry.documentId)!;
          const saved = await this.blobStore.saveFile(
            projectId,
            entry.documentId,
            content,
            doc.mimeType,
          );
          newKeys.set(entry.documentId, saved.storageKey);
        }),
      );

      if (newKeys.size !== toRestore.length) {
        throw new Error('Archive extraction incomplete');
      }

      await this.prisma.$transaction(async (tx) => {
        for (const [docId, key] of newKeys) {
          await tx.document.update({
            where: { id: docId },
            data: { storageKey: key },
          });
        }

        await tx.project.update({
          where: { id: projectId },
          data: {
            archivedAt: null,
            archivedById: null,
            archivedByEmail: null,
            archiveSizeBytes: null,
          },
        });

        flipped = true;
      });

      await this.blobStore.deleteFile(finalKey);

      this.logger.log(
        `Project ${projectId} unarchived by ${actorId}: ${newKeys.size} documents restored`,
      );

      const missingDocuments: MissingArchiveDocument[] = manifest.documents
        .filter((e) => e.missing)
        .map((e) => ({
          id: e.documentId,
          originalFilename: e.originalFilename,
        }));

      return {
        id: projectId,
        restoredDocuments: newKeys.size,
        missingDocuments,
      };
    } catch (error) {
      if (!flipped) {
        for (const key of newKeys.values()) {
          await this.blobStore.deleteFile(key).catch(() => {});
        }
      }

      if (!(error instanceof HttpException)) {
        this.logger.error(
          `Unarchiving project ${projectId} failed: ${String(error)}`,
        );
        throw new ConflictException(
          'Restoring the archive failed; the project is still archived',
        );
      }
      throw error;
    } finally {
      await this.releaseClaim(projectId);
    }
  }

  async getArchiveDownload(
    projectId: string,
    actorId: string,
  ): Promise<{ stream: Readable; filename: string; sizeBytes: number }> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        archivedAt: { not: null },
        deletedAt: null,
      },
      select: { name: true, archiveOperation: true },
    });

    if (!project) {
      throw new NotFoundException('Archived project not found');
    }

    if (project.archiveOperation !== null) {
      throw new ConflictException(
        'This project is being processed. Please try again shortly.',
      );
    }

    const key = archiveKey(projectId);
    const exists = await this.blobStore.exists(key);
    if (!exists) {
      throw new NotFoundException('Archive file not found');
    }

    const filename = `${sanitizeArchiveFileName(project.name)}-archive.zip`;
    const sizeBytes = await this.blobStore.getSize(key);
    const stream = this.blobStore.createReadStream(key);

    this.logger.log(
      `Project ${projectId} archive downloaded by user ${actorId}`,
    );

    return { stream, filename, sizeBytes };
  }

  async deleteArchivedProject(
    projectId: string,
    actorId: string,
  ): Promise<{ id: string }> {
    const claimed = await this.claim(projectId, ArchiveOperation.DELETING, {
      deletedAt: null,
      archivedAt: { not: null },
    });

    if (!claimed) {
      await this.explainClaimFailure(projectId, 'ARCHIVED');
    }

    const key = archiveKey(projectId);
    const deletedKey = deletedArchiveKey(projectId);
    let zipMoved = false;

    try {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { email: true },
      });
      const actorEmail = actor?.email ?? 'unknown';

      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      if (await this.blobStore.exists(key)) {
        await this.blobStore.moveFile(key, deletedKey);
        zipMoved = true;
      } else {
        this.logger.warn(
          `Archive file ${key} not found when moving to deleted area`,
        );
      }

      const docs = await this.prisma.document.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, originalFilename: true, storageKey: true },
      });
      const deletedAt = new Date();

      await this.prisma.$transaction([
        this.prisma.document.updateMany({
          where: { projectId, deletedAt: null },
          data: { deletedAt },
        }),
        this.prisma.deletionLog.createMany({
          data: docs.map((d) => ({
            documentId: d.id,
            projectId,
            projectName: project.name,
            originalFilename: d.originalFilename,
            storageKey: d.storageKey,
            actorId,
            actorEmail: actorEmail,
            deletedAt,
          })),
        }),
        this.prisma.project.update({
          where: { id: projectId },
          data: {
            deletedAt,
            deletedById: actorId,
            deletedByEmail: actorEmail,
            archiveOperation: null,
            archiveOperationStartedAt: null,
          },
        }),
      ]);

      this.logger.log(
        `Archived project ${projectId} soft-deleted to recycle bin by ${actorEmail}`,
      );

      return { id: projectId };
    } catch (error) {
      if (zipMoved) {
        try {
          await this.blobStore.moveFile(deletedKey, key);
        } catch (revertErr) {
          this.logger.error(
            `Failed to revert archive move for project ${projectId}: ${String(revertErr)}`,
          );
        }
      }

      await this.releaseClaim(projectId);

      if (!(error instanceof HttpException)) {
        this.logger.error(
          `Deleting archived project ${projectId} failed: ${String(error)}`,
        );
        throw new ConflictException(
          'Deleting the archived project failed; it is still archived',
        );
      }
      throw error;
    }
  }

  async recoverInterruptedOperations(): Promise<void> {
    const projects = await this.prisma.project.findMany({
      where: { archiveOperation: { not: null } },
    });

    for (const project of projects) {
      try {
        const id = project.id;
        const op = project.archiveOperation;

        if (op === ArchiveOperation.ARCHIVING) {
          if (project.archivedAt === null) {
            // Not flipped: clean up temp and final archive files
            await this.blobStore.deleteFile(archiveTempKey(id)).catch(() => {});
            await this.blobStore.deleteFile(archiveKey(id)).catch(() => {});
          } else {
            // Flipped: clean up remaining active files
            const docs = await this.prisma.document.findMany({
              where: { projectId: id, deletedAt: null },
              select: { storageKey: true },
            });
            for (const doc of docs) {
              if (doc.storageKey && doc.storageKey.startsWith(ACTIVE_PREFIX)) {
                await this.blobStore.deleteFile(doc.storageKey).catch(() => {});
              }
            }
          }
        } else if (op === ArchiveOperation.UNARCHIVING) {
          if (project.archivedAt !== null) {
            // Not flipped: delete extracted active files
            const docs = await this.prisma.document.findMany({
              where: { projectId: id, deletedAt: null },
              select: { id: true, mimeType: true },
            });
            for (const doc of docs) {
              const ext = extensionForMimeType(doc.mimeType);
              const fn = documentFileName(doc.id, ext);
              const activeKey = activeDocumentKey(id, fn);
              await this.blobStore.deleteFile(activeKey).catch(() => {});
              await this.blobStore
                .deleteFile(`${activeKey}.gz`)
                .catch(() => {});
            }
          } else {
            // Flipped: delete archive zip
            await this.blobStore.deleteFile(archiveKey(id)).catch(() => {});
          }
        } else if (op === ArchiveOperation.DELETING) {
          if (project.deletedAt === null) {
            const hasArchive = await this.blobStore.exists(archiveKey(id));
            const hasDeleted = await this.blobStore.exists(
              deletedArchiveKey(id),
            );
            if (!hasArchive && hasDeleted) {
              await this.blobStore
                .moveFile(deletedArchiveKey(id), archiveKey(id))
                .catch(() => {});
            }
          }
        }

        await this.releaseClaim(id);
        this.logger.log(
          `Recovered interrupted operation ${op} on project ${id}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to recover interrupted operation for project ${project.id}: ${String(err)}`,
        );
      }
    }
  }

  private async claim(
    projectId: string,
    operation: ArchiveOperation,
    stateWhere: Prisma.ProjectWhereInput,
  ): Promise<boolean> {
    const updated = await this.prisma.project.updateMany({
      where: {
        id: projectId,
        archiveOperation: null,
        ...stateWhere,
      },
      data: {
        archiveOperation: operation,
        archiveOperationStartedAt: new Date(),
      },
    });

    return updated.count === 1;
  }

  private async releaseClaim(projectId: string): Promise<void> {
    await this.prisma.project.updateMany({
      where: { id: projectId },
      data: {
        archiveOperation: null,
        archiveOperationStartedAt: null,
      },
    });
  }

  private async explainClaimFailure(
    projectId: string,
    expected: 'ACTIVE' | 'ARCHIVED',
  ): Promise<never> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        deletedAt: true,
        archivedAt: true,
        archiveOperation: true,
      },
    });

    if (!project || project.deletedAt !== null) {
      throw new NotFoundException('Project not found');
    }

    if (project.archiveOperation !== null) {
      throw new ConflictException(
        'Another archive operation is already running for this project',
      );
    }

    if (expected === 'ACTIVE' && project.archivedAt !== null) {
      throw new ConflictException('Project is already archived');
    }

    if (expected === 'ARCHIVED' && project.archivedAt === null) {
      throw new NotFoundException('Archived project not found');
    }

    throw new ConflictException(
      'Project cannot be processed in its current state',
    );
  }
}
