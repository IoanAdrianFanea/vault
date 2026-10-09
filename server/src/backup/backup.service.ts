// Direct fs usage allowed: database backup service (RQ7).
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

export function backupFileName(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `docindex-${yyyy}${mm}${dd}-${hh}${min}.sqlite`;
}

export const BACKUP_FILE_PATTERN = /^docindex-(\d{8})-(\d{4})\.sqlite$/;

@Injectable()
export class BackupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BackupService.name);
  private isRunning = false;
  private readonly backupDir: string;
  private readonly keep: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.backupDir = path.resolve(
      this.config.get<string>('BACKUP_DIR') ||
        path.join(
          this.config.get<string>('STORAGE_ROOT') || './data',
          'backups',
        ),
    );
    this.keep = this.config.get<number>('BACKUP_KEEP') ?? 14;
  }

  onApplicationBootstrap(): void {
    void this.runStartupBackupIfStale();
  }

  @Cron('30 2 * * *', { name: 'database-backup' })
  async handleNightlyBackup(): Promise<string | null> {
    return await this.runBackup('nightly');
  }

  async runStartupBackupIfStale(now = new Date()): Promise<string | null> {
    const backups = await this.listBackups();
    if (backups.length === 0) {
      return await this.runBackup('startup');
    }
    const newest = backups[0];
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    if (now.getTime() - newest.createdAt.getTime() > twentyFourHoursMs) {
      return await this.runBackup('startup');
    }
    return null;
  }

  async runBackup(reason: 'nightly' | 'startup'): Promise<string | null> {
    if (this.isRunning) {
      this.logger.warn(
        `Database backup already running; skipping ${reason} run`,
      );
      return null;
    }

    this.isRunning = true;
    const fileName = backupFileName(new Date());
    const finalPath = path.join(this.backupDir, fileName);
    const tempPath = `${finalPath}.tmp`;

    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      try {
        await fs.access(finalPath);
        this.logger.log(`Database backup already exists: ${fileName}`);
        return finalPath;
      } catch {
        // file doesn't exist, proceed
      }

      await fs.rm(tempPath, { force: true });
      try {
        await this.prisma.$executeRaw`VACUUM INTO ${tempPath}`;
      } catch (err) {
        if (typeof this.prisma.$executeRawUnsafe === 'function') {
          await this.prisma.$executeRawUnsafe(
            `VACUUM INTO '${tempPath.replace(/'/g, "''")}'`,
          );
        } else {
          throw err;
        }
      }

      await fs.rename(tempPath, finalPath);
      const stat = await fs.stat(finalPath);
      this.logger.log(
        `Database backup (${reason}) written: ${fileName} (${stat.size} bytes)`,
      );

      await this.pruneOldBackups();
      return finalPath;
    } catch (error) {
      await fs.rm(tempPath, { force: true });
      this.logger.error(`Database backup (${reason}) failed: ${String(error)}`);
      return null;
    } finally {
      this.isRunning = false;
    }
  }

  private async listBackups(): Promise<{ name: string; createdAt: Date }[]> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(this.backupDir);
    } catch {
      return [];
    }

    const backups: { name: string; createdAt: Date }[] = [];
    for (const name of entries) {
      const match = BACKUP_FILE_PATTERN.exec(name);
      if (!match) {
        continue;
      }
      const datePart = match[1];
      const timePart = match[2];
      const year = Number(datePart.slice(0, 4));
      const month = Number(datePart.slice(4, 6)) - 1;
      const day = Number(datePart.slice(6, 8));
      const hour = Number(timePart.slice(0, 2));
      const minute = Number(timePart.slice(2, 4));
      const createdAt = new Date(Date.UTC(year, month, day, hour, minute));
      backups.push({ name, createdAt });
    }

    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return backups;
  }

  private async pruneOldBackups(): Promise<void> {
    const backups = await this.listBackups();
    const toDelete = backups.slice(this.keep);
    for (const b of toDelete) {
      const filePath = path.join(this.backupDir, b.name);
      await fs.rm(filePath, { force: true });
      this.logger.log(`Pruned old backup: ${b.name}`);
    }
  }
}
