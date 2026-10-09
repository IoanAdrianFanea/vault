/*
Helpers for the documents page's live refresh: which statuses mean a document is
still being processed, and how many documents finished between two lists.
*/


import type { Document, DocumentStatus } from '../../types';
import { formatCountLabel } from '../../utils/format';

const IN_PROGRESS_STATUSES: readonly DocumentStatus[] = ['UPLOADED', 'QUEUED', 'PROCESSING'];

export function isInProgress(status: DocumentStatus): boolean {
  return IN_PROGRESS_STATUSES.includes(status);
}

export interface FinishedCounts {
  processed: number;
  failed: number;
}

/** Counts documents that were in progress in `previous` and have now processed or failed. */
export function countFinished(previous: Document[], next: Document[]): FinishedCounts {
  const nextById = new Map(next.map((doc) => [doc.id, doc]));
  const finished: FinishedCounts = { processed: 0, failed: 0 };

  for (const doc of previous) {
    if (!isInProgress(doc.status)) continue;
    const status = nextById.get(doc.id)?.status;
    if (status === 'PROCESSED') finished.processed += 1;
    else if (status === 'FAILED') finished.failed += 1;
  }

  return finished;
}

/** Toast text for finished documents, or null when none finished. */
export function describeFinished({ processed, failed }: FinishedCounts): string | null {
  const parts: string[] = [];
  if (processed > 0) parts.push(`${formatCountLabel(processed, 'document', 'documents')} processed`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.length > 0 ? parts.join(', ') : null;
}
