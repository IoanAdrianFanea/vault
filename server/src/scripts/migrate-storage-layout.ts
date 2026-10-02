/**
 * One-off, idempotent migration script to transition storage layout from
 * legacy {userId}/... to active/{projectId}/... and deleted/{projectId}/...
 *
 * NOTE: The API server MUST be stopped while this migration script runs.
 */

import { Module, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageModule } from '../storage/storage.module';
import { BLOB_STORE, type BlobStore } from '../storage/blob-store.interface';
import {
  ACTIVE_PREFIX,
  activeDocumentKey,
  deletedDocumentKey,
  storageFileName,
} from '../storage/storage-keys';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '.env'),
    }),
    PrismaModule,
    StorageModule,
  ],
})
export class StorageMigrationModule {}

async function main(): Promise<void> {
  const logger = new Logger('StorageMigration');
  const dryRun = process.argv.includes('--dry-run');

  logger.log(`Starting storage migration${dryRun ? ' (DRY RUN)' : ''}...`);

  const app = await NestFactory.createApplicationContext(
    StorageMigrationModule,
    { logger: ['log', 'warn', 'error'] },
  );

  let total = 0;
  let moved = 0;
  let resumed = 0;
  let alreadyMigrated = 0;
  let missing = 0;

  try {
    const prisma = app.get(PrismaService);
    const blobStore = app.get<BlobStore>(BLOB_STORE);
    const config = app.get(ConfigService);

    const docs = await prisma.document.findMany({
      where: { storageKey: { not: '' } },
      select: {
        id: true,
        projectId: true,
        storageKey: true,
        deletedAt: true,
      },
    });

    total = docs.length;

    for (const doc of docs) {
      const key = doc.storageKey;
      const projectId = doc.projectId;

      // Skip already migrated
      if (
        key.startsWith(ACTIVE_PREFIX) ||
        key.startsWith(`deleted/${projectId}/`)
      ) {
        alreadyMigrated++;
        continue;
      }

      const fileName = storageFileName(key);
      const target = doc.deletedAt
        ? deletedDocumentKey(projectId, fileName)
        : activeDocumentKey(projectId, fileName);

      const sourceExists = await blobStore.exists(key);
      const targetExists = await blobStore.exists(target);

      if (sourceExists) {
        if (!dryRun) {
          await blobStore.moveFile(key, target);
          await prisma.document.update({
            where: { id: doc.id },
            data: { storageKey: target },
          });
        }
        moved++;
      } else if (targetExists) {
        if (!dryRun) {
          await prisma.document.update({
            where: { id: doc.id },
            data: { storageKey: target },
          });
        }
        resumed++;
      } else {
        logger.warn(
          `Blob file missing for document ${doc.id} (key: ${key}, expected target: ${target})`,
        );
        missing++;
      }
    }

    if (!dryRun) {
      const rootDir = path.resolve(
        config.get<string>('STORAGE_ROOT') ?? './data',
      );

      const projects = await prisma.project.findMany({
        select: { id: true },
      });
      const validProjectIds = new Set(projects.map((p) => p.id));

      try {
        const topEntries = await fs.readdir(rootDir, { withFileTypes: true });
        for (const entry of topEntries) {
          if (
            entry.isDirectory() &&
            !['active', 'archived', 'deleted'].includes(entry.name)
          ) {
            const dirPath = path.join(rootDir, entry.name);
            await fs.rmdir(dirPath).catch(() => {});
          }
        }

        const deletedDir = path.join(rootDir, 'deleted');
        const deletedEntries = await fs
          .readdir(deletedDir, { withFileTypes: true })
          .catch(() => []);
        for (const entry of deletedEntries) {
          if (entry.isDirectory() && !validProjectIds.has(entry.name)) {
            const dirPath = path.join(deletedDir, entry.name);
            await fs.rmdir(dirPath).catch(() => {});
          }
        }
      } catch (cleanupErr) {
        logger.warn(`Directory cleanup note: ${String(cleanupErr)}`);
      }
    }

    logger.log(
      `Storage migration summary: ${JSON.stringify({
        total,
        moved,
        resumed,
        alreadyMigrated,
        missing,
        dryRun,
      })}`,
    );
  } catch (error) {
    logger.error(`Migration failed: ${String(error)}`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
