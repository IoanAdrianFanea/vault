/*
Nightly 03:00 job that permanently deletes projects and documents past the
retention window, then prunes expired and revoked refresh tokens.
*/


import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecycleBinService } from './recycle-bin.service';
import { PrismaService } from '../prisma/prisma.service';
import { DELETION_RETENTION_DAYS } from '../common/deletion.constants';

/**
 * Permanently deletes documents whose retention window has expired.
 * The in-process guard keeps overlapping runs cheap; RecycleBinService itself is
 * safe against concurrent purges across processes.
 */
@Injectable()
export class PurgeTask {
  private readonly logger = new Logger(PurgeTask.name);
  private isRunning = false;

  constructor(
    private readonly recycleBinService: RecycleBinService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'purge-expired-documents' })
  async handlePurge(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Purge already running — skipping this tick');
      return;
    }

    this.isRunning = true;
    try {
      // Projects first: purging an expired project also removes whatever documents are
      // still in it, so there is nothing left for the document sweep to double-purge.
      const { purged: purgedProjects } =
        await this.recycleBinService.purgeExpiredProjects();
      if (purgedProjects > 0) {
        this.logger.log(
          `Permanently deleted ${purgedProjects} project(s) older than ${DELETION_RETENTION_DAYS} days`,
        );
      }

      const { purged } = await this.recycleBinService.purgeExpiredDocuments();
      if (purged > 0) {
        this.logger.log(
          `Permanently deleted ${purged} document(s) older than ${DELETION_RETENTION_DAYS} days`,
        );
      }

      try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const { count } = await this.prisma.refreshToken.deleteMany({
          where: {
            OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: oneDayAgo } }],
          },
        });
        this.logger.log(`Pruned ${count} old refresh token(s)`);
      } catch (pruneError) {
        this.logger.error(
          `Failed to prune old refresh tokens: ${String(pruneError)}`,
        );
      }
    } catch (error) {
      this.logger.error(`Purge run failed: ${String(error)}`);
    } finally {
      this.isRunning = false;
    }
  }
}
