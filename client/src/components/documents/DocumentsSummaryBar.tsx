import type { DocumentStatusCounts } from '../../api/documents';
import { SummaryBar, TextAction } from '../ui';
import {
  formatCount,
  formatCountLabel,
  formatFileSize,
  formatTime,
} from '../../utils/format';
import { getInProgressCount } from './documentFilters';

export interface DocumentsSummaryBarProps {
  total: number;
  totalBytes: number;
  shownCount: number;
  isCapped: boolean;
  updatedAt: Date;
  counts: DocumentStatusCounts | null;
  isFailedFilterActive: boolean;
  onShowFailed: () => void;
}

export function DocumentsSummaryBar({
  total,
  totalBytes,
  shownCount,
  isCapped,
  updatedAt,
  counts,
  isFailedFilterActive,
  onShowFailed,
}: DocumentsSummaryBarProps) {
  const items = [
    <>
      Total:{' '}
      <strong className="font-semibold text-ink">
        {formatCountLabel(total, 'file', 'files')}
      </strong>
    </>,
    <>
      <strong className="font-semibold text-ink">{formatFileSize(totalBytes)}</strong>{' '}
      {isCapped ? `in the ${formatCount(shownCount)} shown` : 'stored'}
    </>,
    <>Updated {formatTime(updatedAt)}</>,
  ];

  let aside = null;
  if (counts) {
    const inProgress = getInProgressCount(counts);

    aside = (
      <>
        {inProgress > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-status-amber-text">
            <span
              className="size-1.5 rounded-full bg-status-amber-dot"
              aria-hidden="true"
            />
            Indexing {formatCountLabel(inProgress, 'document', 'documents')}
          </span>
        ) : counts.FAILED === 0 ? (
          <span className="inline-flex items-center gap-1 text-accent">
            <span
              className="material-symbols-outlined text-[14px] leading-none"
              aria-hidden="true"
            >
              check_circle
            </span>
            All documents indexed
          </span>
        ) : null}

        {counts.FAILED > 0 &&
          (isFailedFilterActive ? (
            <span className="font-medium text-status-red-text">
              {formatCount(counts.FAILED)} failed
            </span>
          ) : (
            <TextAction tone="danger" variant="inline" onClick={onShowFailed}>
              {formatCount(counts.FAILED)} failed
            </TextAction>
          ))}
      </>
    );
  }

  return <SummaryBar items={items} aside={aside} />;
}
