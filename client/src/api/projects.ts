import { apiFetch } from './http';

export interface AdminProject {
  id: string;
  name: string;
  createdAt: string;
  _count: { memberships: number };
}

export async function getProjects(): Promise<AdminProject[]> {
  const response = await apiFetch('/projects', { method: 'GET' });

  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }

  return response.json();
}

export async function renameProject(id: string, name: string): Promise<AdminProject> {
  const response = await apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to rename project');
  }

  return response.json();
}

export async function createProject(name: string): Promise<AdminProject> {
  const response = await apiFetch('/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to create project');
  }

  return response.json();
}

export async function deleteProject(id: string): Promise<void> {
  const response = await apiFetch(`/projects/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? 'Failed to delete project');
  }
}

export interface ProjectMember {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const response = await apiFetch(`/projects/${projectId}/members`);

  if (!response.ok) throw new Error('Failed to fetch project members');
  return response.json();
}

export async function addProjectMember(projectId: string, userId: string): Promise<void> {
  const response = await apiFetch(`/projects/${projectId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) throw new Error('Failed to add member');
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const response = await apiFetch(`/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to remove member');
}

export interface Project {
  id: string;
  name: string;
}

export type ProjectsScope = 'all' | 'uploadable';

export const projectsService = {
  async listProjects(scope: ProjectsScope = 'all'): Promise<Project[]> {
    const params = new URLSearchParams({ scope });

    const response = await apiFetch(`/projects?${params.toString()}`, { method: 'GET' });

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    return response.json();
  },
};
