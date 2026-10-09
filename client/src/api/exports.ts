import { getFilenameFromContentDisposition } from '../utils/contentDisposition';
import { apiFetch } from './http';

export interface DocumentBlobPayload {
  blob: Blob;
  filename: string;
}

/**
 * Fetch a single document as blob payload.
 */
export async function getDocumentBlob(documentId: string): Promise<DocumentBlobPayload> {
  const response = await apiFetch(`/documents/${documentId}/download`, { method: 'GET' });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Download failed' }));
    throw new Error(error.message || 'Download failed');
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  const filename = getFilenameFromContentDisposition(
    contentDisposition,
    `document-${documentId}.pdf`,
  );

  return {
    blob: await response.blob(),
    filename,
  };
}

/**
 * Download a single document
 */
export async function downloadDocument(documentId: string): Promise<void> {
  try {
    const { blob, filename } = await getDocumentBlob(documentId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw error instanceof Error ? error : new Error('Download failed');
  }
}

/**
 * Export multiple documents as ZIP
 */
export async function exportDocuments(documentIds: string[]): Promise<void> {
  try {
    const response = await apiFetch('/exports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentIds }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(error.message || 'Export failed');
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = getFilenameFromContentDisposition(
      contentDisposition,
      'documents-export.zip',
    );

    // Download the file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw error instanceof Error ? error : new Error('Export failed');
  }
}
