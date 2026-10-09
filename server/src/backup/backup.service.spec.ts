import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import {
  BackupService,
  backupFileName,
  BACKUP_FILE_PATTERN,
} from './backup.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('BackupService', () => {
  let tempDir: string;
  let backupDir: string;
  let prismaMock: {
    $executeRaw: jest.Mock;
    $executeRawUnsafe?: jest.Mock;
  };
  let configMock: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-backup-test-'));
    backupDir = path.join(tempDir, 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    prismaMock = {
      $executeRaw: jest.fn(
        async (_strings: TemplateStringsArray, boundPath: string) => {
          await fs.writeFile(boundPath, 'sqlite-database-data');
          return 1;
        },
      ),
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'BACKUP_DIR') return backupDir;
        if (key === 'BACKUP_KEEP') return 2;
        return undefined;
      }),
    };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('backupFileName and BACKUP_FILE_PATTERN', () => {
    it('formats file name in UTC and matches the pattern', () => {
      const fixedDate = new Date(Date.UTC(2026, 9, 8, 2, 30));
      const fileName = backupFileName(fixedDate);
      expect(fileName).toBe('docindex-20261008-0230.sqlite');
      expect(BACKUP_FILE_PATTERN.test(fileName)).toBe(true);

      const match = BACKUP_FILE_PATTERN.exec(fileName);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('20261008');
      expect(match![2]).toBe('0230');
    });

    it('rejects manual copies from matching the pattern', () => {
      expect(BACKUP_FILE_PATTERN.test('manual-20261008-0230.sqlite')).toBe(
        false,
      );
      expect(BACKUP_FILE_PATTERN.test('docindex-invalid.sqlite')).toBe(false);
    });
  });

  describe('pruning', () => {
    it('keeps the newest keep copies and never touches manual-x.sqlite', async () => {
      // Create older backups and a manual backup
      await fs.writeFile(
        path.join(backupDir, 'docindex-20261001-0230.sqlite'),
        'b1',
      );
      await fs.writeFile(
        path.join(backupDir, 'docindex-20261002-0230.sqlite'),
        'b2',
      );
      await fs.writeFile(
        path.join(backupDir, 'docindex-20261003-0230.sqlite'),
        'b3',
      );
      const manualFile = path.join(backupDir, 'manual-20261001-0000.sqlite');
      await fs.writeFile(manualFile, 'manual-backup');

      const service = new BackupService(
        prismaMock as unknown as PrismaService,
        configMock as unknown as ConfigService,
      );

      // keep is 2. Running a new backup will make 4 docindex files; pruning should keep 2 newest.
      const result = await service.runBackup('nightly');
      expect(result).not.toBeNull();

      const remainingFiles = await fs.readdir(backupDir);

      // manual backup must never be touched
      expect(remainingFiles).toContain('manual-20261001-0000.sqlite');

      const docindexFiles = remainingFiles.filter((f) =>
        BACKUP_FILE_PATTERN.test(f),
      );
      // Exactly 2 newest backups kept
      expect(docindexFiles.length).toBe(2);
      expect(docindexFiles).not.toContain('docindex-20261001-0230.sqlite');
      expect(docindexFiles).not.toContain('docindex-20261002-0230.sqlite');
    });
  });

  describe('runStartupBackupIfStale', () => {
    it('skips startup run when the newest copy is less than 24 hours old', async () => {
      // Create a backup from 12 hours ago
      await fs.writeFile(
        path.join(backupDir, 'docindex-20261008-0230.sqlite'),
        'recent-backup',
      );

      const service = new BackupService(
        prismaMock as unknown as PrismaService,
        configMock as unknown as ConfigService,
      );

      const now = new Date(Date.UTC(2026, 9, 8, 14, 30)); // 12 hours later
      const result = await service.runStartupBackupIfStale(now);

      expect(result).toBeNull();
      expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    });

    it('runs startup backup when the newest copy is older than 24 hours', async () => {
      // Create a backup from 2 days ago
      await fs.writeFile(
        path.join(backupDir, 'docindex-20261006-0230.sqlite'),
        'old-backup',
      );

      const service = new BackupService(
        prismaMock as unknown as PrismaService,
        configMock as unknown as ConfigService,
      );

      const now = new Date(Date.UTC(2026, 9, 8, 14, 30)); // > 24 hours later
      const result = await service.runStartupBackupIfStale(now);

      expect(result).not.toBeNull();
      expect(prismaMock.$executeRaw).toHaveBeenCalled();
    });

    it('runs startup backup when no backups exist at all', async () => {
      const service = new BackupService(
        prismaMock as unknown as PrismaService,
        configMock as unknown as ConfigService,
      );

      const now = new Date(Date.UTC(2026, 9, 8, 14, 30));
      const result = await service.runStartupBackupIfStale(now);

      expect(result).not.toBeNull();
      expect(prismaMock.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    it('leaves no .tmp file and returns null when $executeRaw fails', async () => {
      prismaMock.$executeRaw.mockImplementation(
        async (_strings: TemplateStringsArray, boundPath: string) => {
          // Write partial file before throwing
          await fs.writeFile(boundPath, 'partial-data');
          throw new Error('Database disk error');
        },
      );

      const service = new BackupService(
        prismaMock as unknown as PrismaService,
        configMock as unknown as ConfigService,
      );

      const result = await service.runBackup('nightly');

      expect(result).toBeNull();

      const files = await fs.readdir(backupDir);
      const tmpFiles = files.filter((f) => f.endsWith('.tmp'));
      expect(tmpFiles).toEqual([]);
    });

    it('prevents concurrent runs while isRunning is true', async () => {
      let resolveRaw: () => void;
      const rawPromise = new Promise<void>((resolve) => {
        resolveRaw = resolve;
      });

      prismaMock.$executeRaw.mockImplementation(
        async (_strings: TemplateStringsArray, boundPath: string) => {
          await rawPromise;
          await fs.writeFile(boundPath, 'data');
          return 1;
        },
      );

      const service = new BackupService(
        prismaMock as unknown as PrismaService,
        configMock as unknown as ConfigService,
      );

      const firstRun = service.runBackup('nightly');
      const secondRun = await service.runBackup('startup');

      expect(secondRun).toBeNull();

      resolveRaw!();
      const firstResult = await firstRun;
      expect(firstResult).not.toBeNull();
    });
  });
});
