/*
Recycle bin retention period and the date helpers built on it. Shared by
RecycleBinService and the nightly purge task so the window is defined in one
place.
*/


/** Days a soft-deleted document remains restorable before permanent deletion. */
export const DELETION_RETENTION_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Documents soft-deleted before this instant are eligible for permanent deletion. */
export function getPurgeCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - DELETION_RETENTION_DAYS * MS_PER_DAY);
}

/** Whole days left in the restore window (never negative). */
export function getDaysRemaining(
  deletedAt: Date,
  now: Date = new Date(),
): number {
  const expiresAt = deletedAt.getTime() + DELETION_RETENTION_DAYS * MS_PER_DAY;
  return Math.max(0, Math.ceil((expiresAt - now.getTime()) / MS_PER_DAY));
}
