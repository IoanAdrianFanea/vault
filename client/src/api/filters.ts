import { apiFetch } from './http';

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

export const filtersService = {
  /** Available to any authenticated user — filters power the upload form and document list for everyone. */
  async listFilters(): Promise<FilterDefinition[]> {
    const response = await apiFetch('/filters');

    if (!response.ok) {
      throw new Error('Failed to fetch filters');
    }

    return response.json();
  },

  /** ADMIN ONLY */
  async createFilter(name: string, type: FilterType): Promise<FilterDefinition> {
    const response = await apiFetch('/filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await apiFetch(`/filters/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await apiFetch(`/filters/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? 'Failed to delete filter');
    }
  },
};
