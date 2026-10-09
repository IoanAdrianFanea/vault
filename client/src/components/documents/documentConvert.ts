/*
Converts a document from the API shape into the display shape the document list
and drawers render, with the size and date already formatted.
*/


import type { Document } from '../../types';
import type { Document as ApiDocument } from '../../api/documents';
import { formatDateTime, formatFileSize } from '../../utils/format';

export function toUiDocument(apiDoc: ApiDocument): Document {
  return {
    id: apiDoc.id,
    fileName: apiDoc.originalFilename,
    mimeType: apiDoc.mimeType,
    fileSize: formatFileSize(apiDoc.sizeBytes),
    status: apiDoc.status,
    uploadDate: formatDateTime(apiDoc.uploadedAt),
    uploadedBy: apiDoc.uploadedByEmail,
    errorMessage: apiDoc.errorMessage ?? undefined,
    pageCount: apiDoc.pageCount ?? undefined,
    extractedText: apiDoc.textPreview ?? undefined,
    filterValues: apiDoc.filterValues,
    projectName: apiDoc.projectName,
    sizeBytes: apiDoc.sizeBytes,
    uploadedAt: apiDoc.uploadedAt,
  };
}
