/*
Project business logic: listing visible projects, create, rename, membership
changes and soft deletion. Deleting a project moves it and all its active
documents into the recycle bin together, and archived projects are read-only.
*/


import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BLOB_STORE, type BlobStore } from '../storage/blob-store.interface';
import { LIVE_PROJECT_WHERE } from './project-visibility';
import { deletedDocumentKey, storageFileName } from '../storage/storage-keys';
import { CreateProjectDto } from './dto/CreateProject.dto';
import { UpdateProjectDto } from './dto/UpdateProject.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BLOB_STORE) private readonly blobStore: BlobStore,
  ) {}

  /**
   * List projects visible to the caller.
   * Admins always see every project; non-admins only see projects they are a member of,
   * for both the default and the `uploadable` scope.
   */
  async listProjects(
    userId: string,
    scope: 'all' | 'uploadable' = 'all',
  ): Promise<
    Array<{
      id: string;
      name: string;
      createdAt: Date;
      _count: { memberships: number };
    }>
  > {
    // `scope` is kept for backwards compatibility: `all` and `uploadable` now resolve
    // identically, because membership is what determines visibility either way.
    void scope;

    const projectSelect = {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === UserRole.ADMIN) {
      return this.prisma.project.findMany({
        where: { ...LIVE_PROJECT_WHERE },
        select: projectSelect,
        orderBy: { name: 'asc' },
      });
    }

    return this.prisma.project.findMany({
      where: {
        ...LIVE_PROJECT_WHERE,
        memberships: {
          some: {
            userId,
          },
        },
      },
      select: projectSelect,
      orderBy: { name: 'asc' },
    });
  }

  async createProject(CreateProjectDto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: CreateProjectDto.name,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
    });
  }

  private async assertProjectEditable(
    id: string,
  ): Promise<{ id: string; name: string }> {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        archivedAt: true,
        archiveOperation: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.archivedAt !== null || project.archiveOperation !== null) {
      throw new ConflictException('Archived projects are read-only');
    }

    return { id: project.id, name: project.name };
  }

  /**
   * Soft delete a project — admin only.
   *
   * The project and every one of its currently active documents are moved into the
   * recycle bin together (rather than being destroyed immediately): each active document
   * is soft-deleted exactly like `DocumentsService.deleteDocument` would (file moved to the
   * `deleted/` holding area, a `DeletionLog` row written), all sharing the same `deletedAt`
   * timestamp as the project. That shared timestamp is what lets `RecycleBinService` restore
   * only the documents swept up by this project deletion — documents trashed individually
   * beforehand keep their own `deletedAt` and stay deleted on their own.
   *
   * Memberships are intentionally left untouched so restoring the project also restores its
   * member list; they are only removed when the project is permanently purged.
   */
  async deleteProject(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        archivedAt: true,
        archiveOperation: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.archivedAt !== null || project.archiveOperation !== null) {
      throw new ConflictException(
        'Archived projects can only be deleted from the archive page',
      );
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const activeDocuments = await this.prisma.document.findMany({
      where: { projectId: id, deletedAt: null },
      select: { id: true, storageKey: true, originalFilename: true },
    });

    const deletedAt = new Date();

    for (const document of activeDocuments) {
      const originalStorageKey = document.storageKey;
      const deletedStorageKey = originalStorageKey
        ? deletedDocumentKey(id, storageFileName(originalStorageKey))
        : '';

      if (originalStorageKey) {
        try {
          await this.blobStore.moveFile(document.storageKey, deletedStorageKey);
        } catch (error) {
          // A missing blob must not block the audit trail — log and continue.
          this.logger.warn(
            `Could not move file for document ${document.id} to the deleted area: ${String(error)}`,
          );
        }
      }

      await this.prisma.$transaction([
        this.prisma.document.update({
          where: { id: document.id },
          data: {
            deletedAt,
            ...(originalStorageKey && { storageKey: deletedStorageKey }),
          },
        }),
        this.prisma.deletionLog.create({
          data: {
            documentId: document.id,
            projectId: id,
            projectName: project.name,
            originalFilename: document.originalFilename,
            storageKey: originalStorageKey,
            actorId: userId,
            actorEmail: actor?.email ?? 'unknown',
            deletedAt,
          },
        }),
      ]);
    }

    const updated = await this.prisma.project.updateMany({
      where: { id, deletedAt: null, archivedAt: null, archiveOperation: null },
      data: {
        deletedAt,
        deletedById: userId,
        deletedByEmail: actor?.email ?? null,
      },
    });

    if (updated.count === 0) {
      throw new ConflictException('Project changed while it was being deleted');
    }

    return this.prisma.project.findUnique({
      where: { id },
    });
  }

  async updateProjectName(id: string, UpdateProjectDto: UpdateProjectDto) {
    await this.assertProjectEditable(id);
    return this.prisma.project.update({
      where: { id },
      data: { name: UpdateProjectDto.name },
    });
  }

  async getProjectMembers(id: string) {
    return this.prisma.projectMembership.findMany({
      where: { projectId: id },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async addProjectMember(id: string, userId: string) {
    await this.assertProjectEditable(id);
    return this.prisma.projectMembership.create({
      data: {
        projectId: id,
        userId,
      },
    });
  }

  async removeProjectMember(id: string, userId: string) {
    await this.assertProjectEditable(id);
    return this.prisma.projectMembership.deleteMany({
      where: {
        projectId: id,
        userId,
      },
    });
  }

  async getProject(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        memberships: {
          select: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }
}
