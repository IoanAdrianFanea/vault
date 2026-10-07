import { getFilenameFromContentDisposition } from '../utils/contentDisposition';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

function authHeaders(): Record<string, string> {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) {
    throw new Error('Not authenticated');
  }
  return { Authorization: `Bearer ${accessToken}` };
}

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.message ?? fallback;
}

export async function getArchivedProjects(): Promise<ArchivedProject[]> {
  const response = await fetch(`${API_URL}/archive`, {
    headers: authHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to fetch archived projects'));
  }

  return response.json();
}

export async function archiveProject(id: string): Promise<ArchiveProjectResult> {
  const response = await fetch(`${API_URL}/archive/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to archive project'));
  }

  return response.json();
}

export async function unarchiveProject(id: string): Promise<UnarchiveProjectResult> {
  const response = await fetch(
    `${API_URL}/archive/${encodeURIComponent(id)}/restore`,
    {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to unarchive project'));
  }

  return response.json();
}

export async function downloadProjectArchive(
  id: string,
  fallbackName: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/archive/${encodeURIComponent(id)}/download`,
    {
      method: 'GET',
      headers: authHeaders(),
      credentials: 'include',
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to download project archive'));
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
  const response = await fetch(`${API_URL}/archive/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to delete archived project'));
  }
}
