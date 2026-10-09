/*
Sortable, selectable table of documents with per-row download and retry actions.
Sort changes and selection are reported back to the documents page.
*/


import type { Document } from '../../types';
import {
  Checkbox,
  DataTable,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableSkeletonRows,
  StatusBadge,
  TextAction,
} from '../ui';
import type { DocumentSortBy } from './documentFilters';

export interface DocumentTableProps {
  documents: Document[];
  isLoading: boolean;
  selectedIds: Set<string>;
  sortBy: DocumentSortBy;
  onSortChange: (sortBy: DocumentSortBy) => void;
  onOpenPreview: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onDownload: (id: string) => void;
  onRetry: (id: string) => void;
}

export function DocumentTable({
  documents,
  isLoading,
  selectedIds,
  sortBy,
  onSortChange,
  onOpenPreview,
  onToggleSelect,
  onSelectAll,
  onDownload,
  onRetry,
}: DocumentTableProps) {
  const allSelected = documents.length > 0 && documents.every((doc) => selectedIds.has(doc.id));
  const someSelected = documents.some((doc) => selectedIds.has(doc.id)) && !allSelected;

  return (
    <DataTable fixed busy={isLoading && documents.length > 0} label="Documents">
      <thead>
        <tr>
          <TableHeaderCell className="w-10" align="center">
            <Checkbox
              aria-label="Select all shown documents"
              checked={allSelected}
              indeterminate={someSelected}
              disabled={documents.length === 0}
              onChange={(e) => onSelectAll(e.target.checked)}
            />
          </TableHeaderCell>
          <TableHeaderCell
            sortDirection={
              sortBy === 'name-asc'
                ? 'ascending'
                : sortBy === 'name-desc'
                ? 'descending'
                : null
            }
            onSort={() => onSortChange(sortBy === 'name-asc' ? 'name-desc' : 'name-asc')}
          >
            Document
          </TableHeaderCell>
          <TableHeaderCell
            className="w-32"
            sortDirection={sortBy === 'status' ? 'ascending' : null}
            onSort={() => onSortChange('status')}
          >
            Status
          </TableHeaderCell>
          <TableHeaderCell className="w-56">Uploaded by</TableHeaderCell>
          <TableHeaderCell
            className="w-40"
            sortDirection={
              sortBy === 'upload-newest'
                ? 'descending'
                : sortBy === 'upload-oldest'
                ? 'ascending'
                : null
            }
            onSort={() =>
              onSortChange(sortBy === 'upload-newest' ? 'upload-oldest' : 'upload-newest')
            }
          >
            Date uploaded
          </TableHeaderCell>
          <TableHeaderCell className="w-44" align="end">
            Actions
          </TableHeaderCell>
        </tr>
      </thead>
      <tbody>
        {documents.length === 0 && isLoading ? (
          <TableSkeletonRows columns={6} />
        ) : (
          documents.map((doc) => {
            const isSelected = selectedIds.has(doc.id);
            const isFailed = doc.status === 'FAILED';

            return (
              <TableRow
                key={doc.id}
                selected={isSelected}
                onClick={() => onOpenPreview(doc.id)}
              >
                <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={`Select ${doc.fileName}`}
                    checked={isSelected}
                    onChange={() => onToggleSelect(doc.id)}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    title={doc.fileName}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPreview(doc.id);
                    }}
                    className="block max-w-full truncate rounded-sm text-left text-body font-medium text-ink hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {doc.fileName}
                  </button>
                  <span className="block text-small text-ink-muted tabular-nums">
                    {doc.fileSize}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={doc.status} errorMessage={doc.errorMessage} />
                </TableCell>
                <TableCell className="truncate" title={doc.uploadedBy}>
                  {doc.uploadedBy ?? '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap text-ink-muted tabular-nums">
                  {doc.uploadDate}
                </TableCell>
                <TableCell align="end" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-1.5">
                    {isFailed ? (
                      <TextAction
                        tone="danger"
                        aria-label={`Retry processing ${doc.fileName}`}
                        onClick={() => onRetry(doc.id)}
                      >
                        Retry
                      </TextAction>
                    ) : (
                      <TextAction
                        tone="accent"
                        aria-label={`Preview ${doc.fileName}`}
                        onClick={() => onOpenPreview(doc.id)}
                      >
                        Preview
                      </TextAction>
                    )}
                    <span className="text-small text-line-strong" aria-hidden="true">
                      /
                    </span>
                    <TextAction
                      tone="muted"
                      aria-label={`Download ${doc.fileName}`}
                      onClick={() => onDownload(doc.id)}
                    >
                      Download
                    </TextAction>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </tbody>
    </DataTable>
  );
}
