/*
Restores the SQLite database from a backup when a RESTORE marker file in the
backups folder names one, then renames the marker so it runs only once.
Called before the server starts, through scripts/restore-database.ts.
*/
// Direct fs usage allowed: database restore hook (RQ7).


import { promises as fs } from 'fs';
import * as path from 'path';

export async function restoreDatabaseIfRequested(
  env: NodeJS.ProcessEnv,
  now = new Date(),
): Promise<{ restored: boolean; message: string }> {
  if (!env.DATABASE_URL || !env.DATABASE_URL.startsWith('file:')) {
    return {
      restored: false,
      message: 'Restore skipped: DATABASE_URL is not a SQLite file URL',
    };
  }

  const dbPath = path.resolve(env.DATABASE_URL.slice('file:'.length));
  const backupDir = path.resolve(
    env.BACKUP_DIR?.trim() ||
      path.join(env.STORAGE_ROOT?.trim() || './data', 'backups'),
  );

  const markerPath = path.join(backupDir, 'RESTORE');
  try {
    await fs.access(markerPath);
  } catch {
    return { restored: false, message: 'No restore requested' };
  }

  const fileName = (await fs.readFile(markerPath, 'utf8')).trim();
  if (!/^[A-Za-z0-9._-]+\.sqlite$/.test(fileName)) {
    throw new Error(
      'RESTORE must contain only the name of a .sqlite file in the backups folder',
    );
  }

  const source = path.join(backupDir, fileName);
  try {
    await fs.access(source);
  } catch {
    throw new Error(`Backup ${fileName} was not found in the backups folder`);
  }

  const tempPath = `${dbPath}.restore-tmp`;
  await fs.copyFile(source, tempPath);
  await fs.rm(`${dbPath}-journal`, { force: true });
  await fs.rm(`${dbPath}-wal`, { force: true });
  await fs.rm(`${dbPath}-shm`, { force: true });
  await fs.rename(tempPath, dbPath);

  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const doneMarkerName = `RESTORE.done-${yyyy}${mm}${dd}-${hh}${min}`;
  await fs.rename(markerPath, path.join(backupDir, doneMarkerName));

  return { restored: true, message: `Database restored from ${fileName}` };
}
