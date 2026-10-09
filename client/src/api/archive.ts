import { getFilenameFromContentDisposition } from '../utils/contentDisposition';
import { apiFetch, readErrorMessage } from './http';

export type ArchiveOperation = 'ARCHIVING' | 'UNARCHIVING' | 'DELETING';

export interface MissingArchiveDocument {
  id: string;
  originalFilename: string;
}

export interface ArchivedProject {
  id: string;
  name: string;
  archivedAt: string;
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
  archivedAt: string;
  archiveSizeBytes: number;
  documentCount: number;
  missingDocuments: MissingArchiveDocument[];
}

export interface UnarchiveProjectResult {
  id: string;
  restoredDocuments: number;
  missingDocuments: MissingArchiveDocument[];
}

export async function getArchivedProjects(): Promise<ArchivedProject[]> {
  const response = await apiFetch('/archive');

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to fetch archived projects'));
  }

  return response.json();
}

export async function archiveProject(id: string): Promise<ArchiveProjectResult> {
  const response = await apiFetch(`/archive/${encodeURIComponent(id)}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to archive project'));
  }

  return response.json();
}

export async function unarchiveProject(id: string): Promise<UnarchiveProjectResult> {
  const response = await apiFetch(`/archive/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to unarchive project'));
  }

  return response.json();
}

export async function downloadProjectArchive(
  id: string,
  fallbackName: string,
): Promise<void> {
  const response = await apiFetch(`/archive/${encodeURIComponent(id)}/download`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to download project archive'));
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  const filename = getFilenameFromContentDisposition(
    contentDisposition,
    `${fallbackName}-archive.zip`,
  );

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function deleteArchivedProject(id: string): Promise<void> {
  const response = await apiFetch(`/archive/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to delete archived project'));
  }
}
