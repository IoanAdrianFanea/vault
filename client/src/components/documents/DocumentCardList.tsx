/*
Phone list of documents as cards: name, status, size, uploader and date, with a
download button. Tapping a card opens the document view. Phones have no
selection, bulk actions or retry, so the cards have none either.
*/


import type { Document } from '../../types';
import { IconButton, StatusBadge } from '../ui';

export interface DocumentCardListProps {
  documents: Document[];
  isLoading: boolean;
  onOpen: (id: string) => void;
  onDownload: (id: string) => void;
}

export function DocumentCardList({
  documents,
  isLoading,
  onOpen,
  onDownload,
}: DocumentCardListProps) {
  if (documents.length === 0 && isLoading) {
    return (
      <ul className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <li
            key={index}
            className="flex flex-col gap-2 rounded border border-line bg-canvas p-3"
          >
            <span className="block h-4 w-3/4 animate-pulse rounded-sm bg-line" />
            <span className="block h-3 w-1/3 animate-pulse rounded-sm bg-line" />
            <span className="block h-3 w-1/2 animate-pulse rounded-sm bg-line" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      aria-label="Documents"
      aria-busy={isLoading || undefined}
      className={`flex flex-col gap-2 ${isLoading ? 'opacity-60' : ''}`}
    >
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center gap-1 rounded border border-line bg-canvas"
        >
          <button
            type="button"
            onClick={() => onOpen(doc.id)}
            className="flex min-w-0 flex-1 flex-col gap-1.5 rounded py-3 pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="line-clamp-2 text-[14px] font-medium leading-5 text-ink [overflow-wrap:anywhere]">
              {doc.fileName}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={doc.status} errorMessage={doc.errorMessage} />
              <span className="text-small text-ink-muted tabular-nums">{doc.fileSize}</span>
            </span>
            <span className="text-small text-ink-muted tabular-nums">
              {[doc.uploadedBy, doc.uploadDate].filter(Boolean).join(' · ')}
            </span>
          </button>
          <IconButton
            icon="download"
            label={`Download ${doc.fileName}`}
            onClick={() => onDownload(doc.id)}
            className="mr-1 shrink-0 text-ink-muted max-md:size-11"
          />
        </li>
      ))}
    </ul>
  );
}
