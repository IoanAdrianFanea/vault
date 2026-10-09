import { getFilenameFromContentDisposition } from '../utils/contentDisposition';
import { saveFile, type SaveResult, type SaveTarget } from '../utils/saveFile';
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
export async function downloadDocument(
  documentId: string,
  options: { projectName?: string; target?: Promise<SaveTarget> } = {},
): Promise<SaveResult> {
  try {
    const { blob, filename } = await getDocumentBlob(documentId);
    return await saveFile(blob, filename, options);
  } catch (error) {
    throw error instanceof Error ? error : new Error('Download failed');
  }
}

/**
 * Export multiple documents as ZIP
 */
export async function exportDocuments(
  documentIds: string[],
  options: { projectName?: string; target?: Promise<SaveTarget> } = {},
): Promise<SaveResult> {
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

    const blob = await response.blob();
    return await saveFile(blob, filename, options);
  } catch (error) {
    throw error instanceof Error ? error : new Error('Export failed');
  }
}
