/*
Shared types and constants for project archives: the manifest.json format
stored inside each archive zip and the result shapes returned by the archive
endpoints.
*/


import type { ArchiveOperation } from '@prisma/client';

export const ARCHIVE_MANIFEST_VERSION = 1;
export const ARCHIVE_MANIFEST_NAME = 'manifest.json';
export const ARCHIVE_FILES_DIR = 'files/';

export interface ArchiveManifestEntry {
  documentId: string;
  entryName: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  missing: boolean;
}

export interface ArchiveManifest {
  version: number;
  projectId: string;
  projectName: string;
  archivedAt: string; // ISO date string
  documents: ArchiveManifestEntry[];
}

export interface MissingArchiveDocument {
  id: string;
  originalFilename: string;
}

export interface ArchivedProjectSummary {
  id: string;
  name: string;
  archivedAt: Date;
  archivedByEmail: string | null;
  archivedByName: string | null;
  archiveSizeBytes: number;
  documentCount: number;
  memberCount: number;
  operation: ArchiveOperation | null;
}

export interface ArchiveProjectResult {
  id: string;
  name: string;
  archivedAt: Date;
  archiveSizeBytes: number;
  documentCount: number;
  missingDocuments: MissingArchiveDocument[];
}

export interface UnarchiveProjectResult {
  id: string;
  restoredDocuments: number;
  missingDocuments: MissingArchiveDocument[];
}
