import type { DocumentStatus } from '../../types';
import type { BadgeTone } from './Badge';

export interface DocumentStatusStyle {
  label: string;
  badgeTone: BadgeTone;
  dotClassName: string;
}

export const DOCUMENT_STATUS_ORDER: readonly DocumentStatus[] = [
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
];

export const documentStatusStyles: Record<DocumentStatus, DocumentStatusStyle> = {
  UPLOADED: {
    label: 'Uploaded',
    badgeTone: 'amber',
    dotClassName: 'bg-line-strong',
  },
  QUEUED: {
    label: 'Queued',
    badgeTone: 'amber',
    dotClassName: 'bg-ink-muted',
  },
  PROCESSING: {
    label: 'Processing',
    badgeTone: 'amber',
    dotClassName: 'bg-status-amber-dot',
  },
  PROCESSED: {
    label: 'Processed',
    badgeTone: 'teal',
    dotClassName: 'bg-accent',
  },
  FAILED: {
    label: 'Failed',
    badgeTone: 'red',
    dotClassName: 'bg-status-red-dot',
  },
};
