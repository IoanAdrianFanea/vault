/*
Shared front-end types for documents and jobs, used by the document list,
drawers and jobs views. The document shape here is the view model the UI
renders, which differs from the raw API type.
*/


export type DocumentStatus = 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
export type FilterType = 'TEXT' | 'NUMBER' | 'DATE';

export interface DocumentFilterValue {
  filterDefinitionId: string;
  name: string;
  type: FilterType;
  value: string | null;
}

export interface Document {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: string;
  status: DocumentStatus;
  uploadDate: string;
  uploadedBy?: string;
  errorMessage?: string;
  pageCount?: number;
  extractedText?: string;
  filterValues?: DocumentFilterValue[];
  projectName?: string;
  sizeBytes?: number;
  uploadedAt?: string;
}

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type JobType = 'EXPORT' | 'INDEX' | 'EXTRACT';

export interface Job {
  id: string;
  type: JobType;
  title: string;
  status: JobStatus;
  createdAt: string;
  createdBy: string;
  completedAt?: string;
  duration?: string;
  fileSize?: string;
  fileCount?: number;
  files?: string[];
  errorMessage?: string;
}
