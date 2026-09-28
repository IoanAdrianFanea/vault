const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type FilterType = 'TEXT' | 'NUMBER' | 'DATE';

export const MAX_ACTIVE_FILTERS = 5;

export interface FilterDefinition {
  id: string;
  name: string;
  type: FilterType;
  order: number;
  createdAt: string;
  updatedAt: string;
}

function authHeaders(): Record<string, string> {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) {
    throw new Error('Not authenticated');
  }
  return { Authorization: `Bearer ${accessToken}` };
}

export const filtersService = {
  /** Available to any authenticated user — filters power the upload form and document list for everyone. */
  async listFilters(): Promise<FilterDefinition[]> {
    const response = await fetch(`${API_URL}/filters`, {
      headers: authHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch filters');
    }

    return response.json();
  },

  /** ADMIN ONLY */
  async createFilter(name: string, type: FilterType): Promise<FilterDefinition> {
    const response = await fetch(`${API_URL}/filters`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, type }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? 'Failed to create filter');
    }

    return response.json();
  },

  /** ADMIN ONLY */
  async updateFilter(
    id: string,
    payload: { name?: string; type?: FilterType },
  ): Promise<FilterDefinition> {
    const response = await fetch(`${API_URL}/filters/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? 'Failed to update filter');
    }

    return response.json();
  },

  /** ADMIN ONLY */
  async deleteFilter(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/filters/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? 'Failed to delete filter');
    }
  },
};
