/*
Shared Prisma where-clauses defining which projects are live (shown in normal
views) and writable (accepting changes). Used wherever projects or their
documents are read or modified.
*/


import type { Prisma } from '@prisma/client';

/**
 * Filter predicate matching projects that are currently active in main views.
 * Projects that are in the recycle bin (deletedAt != null) or archived (archivedAt != null)
 * are excluded.
 */
export const LIVE_PROJECT_WHERE = {
  deletedAt: null,
  archivedAt: null,
} satisfies Prisma.ProjectWhereInput;

/**
 * Filter predicate matching projects that are live and accepting modifications.
 * Projects that are soft-deleted, archived, or currently undergoing an archive, unarchive,
 * or delete operation (archiveOperation != null) are excluded.
 */
export const WRITABLE_PROJECT_WHERE = {
  ...LIVE_PROJECT_WHERE,
  archiveOperation: null,
} satisfies Prisma.ProjectWhereInput;
