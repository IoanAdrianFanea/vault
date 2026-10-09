import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { restoreDatabaseIfRequested } from './restore-database';

describe('restoreDatabaseIfRequested', () => {
  let tempDir: string;
  let dbPath: string;
  let backupDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-restore-test-'));
    dbPath = path.join(tempDir, 'vault.db');
    backupDir = path.join(tempDir, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(dbPath, 'original-db-content');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('does nothing when no marker exists', async () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: `file:${dbPath}`,
      BACKUP_DIR: backupDir,
    };

    const result = await restoreDatabaseIfRequested(env);

    expect(result).toEqual({
      restored: false,
      message: 'No restore requested',
    });
    expect(await fs.readFile(dbPath, 'utf8')).toBe('original-db-content');
  });

  it('replaces the database file, removes -journal, and renames the marker', async () => {
    const backupFile = path.join(backupDir, 'valid-backup.sqlite');
    await fs.writeFile(backupFile, 'restored-backup-content');

    const journalPath = `${dbPath}-journal`;
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    await fs.writeFile(journalPath, 'stale-journal');
    await fs.writeFile(walPath, 'stale-wal');
    await fs.writeFile(shmPath, 'stale-shm');

    const markerPath = path.join(backupDir, 'RESTORE');
    await fs.writeFile(markerPath, '  valid-backup.sqlite  \n');

    const fixedDate = new Date(Date.UTC(2026, 9, 8, 14, 30));
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: `file:${dbPath}`,
      BACKUP_DIR: backupDir,
    };

    const result = await restoreDatabaseIfRequested(env, fixedDate);

    expect(result).toEqual({
      restored: true,
      message: 'Database restored from valid-backup.sqlite',
    });

    expect(await fs.readFile(dbPath, 'utf8')).toBe('restored-backup-content');

    await expect(fs.access(journalPath)).rejects.toThrow();
    await expect(fs.access(walPath)).rejects.toThrow();
    await expect(fs.access(shmPath)).rejects.toThrow();
    await expect(fs.access(markerPath)).rejects.toThrow();

    const doneMarkerPath = path.join(backupDir, 'RESTORE.done-20261008-1430');
    expect(await fs.readFile(doneMarkerPath, 'utf8')).toBe(
      '  valid-backup.sqlite  \n',
    );
  });

  it('throws when marker contains path separators like ../x.sqlite', async () => {
    const markerPath = path.join(backupDir, 'RESTORE');
    await fs.writeFile(markerPath, '../x.sqlite');

    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: `file:${dbPath}`,
      BACKUP_DIR: backupDir,
    };

    await expect(restoreDatabaseIfRequested(env)).rejects.toThrow(
      'RESTORE must contain only the name of a .sqlite file in the backups folder',
    );
  });

  it('throws when backup file is missing', async () => {
    const markerPath = path.join(backupDir, 'RESTORE');
    await fs.writeFile(markerPath, 'missing.sqlite');

    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: `file:${dbPath}`,
      BACKUP_DIR: backupDir,
    };

    await expect(restoreDatabaseIfRequested(env)).rejects.toThrow(
      'Backup missing.sqlite was not found in the backups folder',
    );
  });

  it('skips restore if DATABASE_URL is not a file URL', async () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: 'postgresql://localhost/vault',
      BACKUP_DIR: backupDir,
    };

    const result = await restoreDatabaseIfRequested(env);
    expect(result).toEqual({
      restored: false,
      message: 'Restore skipped: DATABASE_URL is not a SQLite file URL',
    });
  });
});
