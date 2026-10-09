/*
Client for the admin recycle bin endpoints: list deleted documents and projects,
restore them or delete them permanently.
*/


import { apiFetch } from './http';

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
  const response = await apiFetch('/recycle-bin');

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load the recycle bin'));
  }

  return response.json();
}

export async function getDeletedProjects(): Promise<DeletedProject[]> {
  const response = await apiFetch('/recycle-bin/projects');

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load deleted projects'));
  }

  return response.json();
}

export async function getDeletedProjectDocuments(projectId: string): Promise<DeletedDocument[]> {
  const response = await apiFetch(
    `/recycle-bin/projects/${encodeURIComponent(projectId)}/documents`,
  );

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load the project documents'));
  }

  return response.json();
}

export async function restoreProject(id: string): Promise<void> {
  const response = await apiFetch(`/recycle-bin/projects/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to restore project'));
  }
}

export async function permanentlyDeleteProject(id: string): Promise<void> {
  const response = await apiFetch(`/recycle-bin/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to permanently delete project'));
  }
}

export async function restoreDocument(id: string, targetProjectId?: string): Promise<void> {
  const response = await apiFetch(`/recycle-bin/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(targetProjectId ? { targetProjectId } : {}),
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to restore document'));
  }
}

export async function permanentlyDeleteDocument(id: string): Promise<void> {
  const response = await apiFetch(`/recycle-bin/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to permanently delete document'));
  }
}
