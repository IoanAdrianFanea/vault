const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface AdminProject {
  id: string;
  name: string;
  createdAt: string;
  _count: { memberships: number };
}

export async function getProjects(): Promise<AdminProject[]> {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/projects`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }

  return response.json();
}

export async function renameProject(id: string, name: string): Promise<AdminProject> {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/projects/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to rename project');
  }

  return response.json();
}

export async function createProject(name: string): Promise<AdminProject> {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to create project');
  }

  return response.json();
}

export async function deleteProject(id: string): Promise<void> {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/projects/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

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
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/projects/${projectId}/members`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });

  if (!response.ok) throw new Error('Failed to fetch project members');
  return response.json();
}

export async function addProjectMember(projectId: string, userId: string): Promise<void> {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) throw new Error('Failed to add member');
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
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
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const params = new URLSearchParams({ scope });

    const response = await fetch(`${API_URL}/projects?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    return response.json();
  },
};
