const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface DeletedDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  projectId: string;
  projectName: string;
  deletedAt: string;
  deletedByEmail: string | null;
  deletedByName: string | null;
  daysRemaining: number;
  retentionDays: number;
  restorable: boolean;
  requiresProjectChoice: boolean;
}

function authHeaders(): Record<string, string> {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) {
    throw new Error('Not authenticated');
  }
  return { Authorization: `Bearer ${accessToken}` };
}

export interface DeletedProject {
  id: string;
  name: string;
  deletedAt: string;
  deletedByEmail: string | null;
  deletedByName: string | null;
  documentCount: number;
  daysRemaining: number;
  retentionDays: number;
  isArchived: boolean;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.message ?? fallback;
}

export async function getDeletedDocuments(): Promise<DeletedDocument[]> {
  const response = await fetch(`${API_URL}/recycle-bin`, {
    headers: authHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load the recycle bin'));
  }

  return response.json();
}

export async function getDeletedProjects(): Promise<DeletedProject[]> {
  const response = await fetch(`${API_URL}/recycle-bin/projects`, {
    headers: authHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load deleted projects'));
  }

  return response.json();
}

export async function getDeletedProjectDocuments(projectId: string): Promise<DeletedDocument[]> {
  const response = await fetch(
    `${API_URL}/recycle-bin/projects/${encodeURIComponent(projectId)}/documents`,
    {
      headers: authHeaders(),
      credentials: 'include',
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load the project documents'));
  }

  return response.json();
}

export async function restoreProject(id: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/recycle-bin/projects/${encodeURIComponent(id)}/restore`,
    {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to restore project'));
  }
}

export async function permanentlyDeleteProject(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/recycle-bin/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to permanently delete project'));
  }
}

export async function restoreDocument(id: string, targetProjectId?: string): Promise<void> {
  const response = await fetch(`${API_URL}/recycle-bin/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(targetProjectId ? { targetProjectId } : {}),
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to restore document'));
  }
}

export async function permanentlyDeleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/recycle-bin/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to permanently delete document'));
  }
}
