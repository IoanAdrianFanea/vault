import type { FilterType } from './filters';

// API base URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type DocumentStatus = 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface DocumentFilterValue {
  filterDefinitionId: string;
  name: string;
  type: FilterType;
  value: string | null;
}

export interface Document {
  id: string;
  projectId?: string;
  projectName?: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: DocumentStatus;
  errorMessage?: string | null;
  uploadedByEmail?: string;
  extractedAt?: string | null;
  pageCount?: number | null;
  textPreview?: string | null;
  filterValues?: DocumentFilterValue[];
}

/** Raw value(s) submitted for one custom filter in a document list/search query. */
export interface CustomFilterQueryValue {
  value?: string;
  from?: string;
  to?: string;
}

export interface ListDocumentsFilters {
  projectId?: string;
  mainFilter?: string;
  /** Keyed by FilterDefinition id — see filters.ts. */
  customFilters?: Record<string, CustomFilterQueryValue>;
  status?: DocumentStatus;
  sortBy?: 'upload-newest' | 'upload-oldest' | 'name-asc' | 'name-desc' | 'status';
}

export interface DocumentStatusCounts {
  UPLOADED: number;
  QUEUED: number;
  PROCESSING: number;
  PROCESSED: number;
  FAILED: number;
}

export interface UploadResponse {
  id: string;
  status: DocumentStatus;
}

/** Builds the query string shared by listDocuments and getStatusCounts. */
function buildListDocumentsParams(
  filters: ListDocumentsFilters | undefined,
  options: { includeStatusAndSort: boolean },
): URLSearchParams {
  const params = new URLSearchParams();
  if (!filters) return params;

  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.mainFilter && filters.mainFilter.trim() !== '') {
    params.set('mainFilter', filters.mainFilter);
  }
  if (filters.customFilters && Object.keys(filters.customFilters).length > 0) {
    params.set('customFilters', JSON.stringify(filters.customFilters));
  }
  if (options.includeStatusAndSort) {
    if (filters.status) params.set('status', filters.status);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
  }

  return params;
}

// Documents API service
export const documentsService = {
  /**
   * Upload a PDF file
   */
  async uploadDocument(
    file: File,
    projectId: string,
    filterValues?: Record<string, string>,
  ): Promise<UploadResponse> {
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    if (filterValues && Object.keys(filterValues).length > 0) {
      formData.append('filterValues', JSON.stringify(filterValues));
    }

    const response = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required');
      }
      if (response.status === 400) {
        const error = await response.json().catch(() => ({ message: 'Invalid file' }));
        throw new Error(error.message || 'Invalid file');
      }
      if (response.status === 413) {
        throw new Error('File too large. Maximum size is 50MB');
      }
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  },

  /**
   * Get all documents for current user
   */
  async listDocuments(filters?: ListDocumentsFilters): Promise<Document[]> {
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const params = buildListDocumentsParams(filters, { includeStatusAndSort: true });

    const queryString = params.toString();
    const url = queryString ? `${API_URL}/documents?${queryString}` : `${API_URL}/documents`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }

    return response.json();
  },

  /**
   * Get document status counts
   */
  async getStatusCounts(filters?: ListDocumentsFilters): Promise<DocumentStatusCounts> {
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const params = buildListDocumentsParams(filters, { includeStatusAndSort: false });

    const queryString = params.toString();
    const url = queryString ? `${API_URL}/documents/status-counts?${queryString}` : `${API_URL}/documents/status-counts`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch status counts');
    }

    const data = (await response.json()) as Partial<DocumentStatusCounts>;
    return {
      UPLOADED: data.UPLOADED ?? 0,
      QUEUED: data.QUEUED ?? 0,
      PROCESSING: data.PROCESSING ?? 0,
      PROCESSED: data.PROCESSED ?? 0,
      FAILED: data.FAILED ?? 0,
    };
  },

  /**
   * Get a single document by ID
   */
  async getDocument(id: string): Promise<Document> {
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/documents/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Document not found');
      }
      throw new Error('Failed to fetch document');
    }

    return response.json();
  },

  /**
   * Get extracted text for a document
   */
  async getDocumentText(id: string): Promise<DocumentText> {
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/documents/${id}/text`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Extracted text not found');
      }
      throw new Error('Failed to fetch document text');
    }

    return response.json();
  },

  /**
   * Search documents by filename and text content
   */
  async searchDocuments(query: string): Promise<{ results: SearchResult[] }> {
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const params = new URLSearchParams({ q: query });
    const response = await fetch(`${API_URL}/documents/search?${params}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 400) {
        const error = await response.json().catch(() => ({ message: 'Invalid search query' }));
        throw new Error(error.message || 'Invalid search query');
      }
      throw new Error('Search failed');
    }

    return response.json();
  },

  /**
   * Delete a single document
   */
  async deleteDocument(id: string): Promise<{ success: boolean }> {
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/documents/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Document not found');
      }
      throw new Error('Failed to delete document');
    }

    return response.json();
  },

  /**
   * Bulk delete multiple documents
   */
  async bulkDeleteDocuments(documentIds: string[]): Promise<{ deleted: number; failed: string[] }> {
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/documents/bulk-delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ documentIds }),
    });

    if (!response.ok) {
      throw new Error('Failed to delete documents');
    }

    return response.json();
  },
};

export interface SearchResult {
  documentId: string;
  filename: string;
  snippet: string;
}

export interface DocumentText {
  documentId: string;
  extractedText: string;
  extractedAt: string;
}
