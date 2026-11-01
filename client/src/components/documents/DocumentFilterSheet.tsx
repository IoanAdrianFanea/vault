/*
Phone sheet for sorting and filtering documents: sort order, status, keywords and
one field per custom filter. Like the desktop popover it edits a draft, and sort,
status and filters all apply together on Apply. Mount it only while it is open.
*/


import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  documentsService,
  type DocumentStatus,
  type DocumentStatusCounts,
} from '../../api/documents';
import type { FilterDefinition } from '../../api/filters';
import {
  Button,
  DOCUMENT_STATUS_ORDER,
  documentStatusStyles,
  FormField,
  Input,
  Modal,
  TextAction,
} from '../ui';
import { formatCount } from '../../utils/format';
import {
  DOCUMENT_SORT_OPTIONS,
  normaliseFilters,
  type AppliedFilters,
  type DocumentSortBy,
} from './documentFilters';
import { useFilterDraft } from './useFilterDraft';

export interface DocumentFilterSheetApply {
  filters: AppliedFilters;
  sortBy: DocumentSortBy;
  status: DocumentStatus | null;
}

export interface DocumentFilterSheetProps {
  applied: AppliedFilters;
  sortBy: DocumentSortBy;
  status: DocumentStatus | undefined;
  filterDefinitions: FilterDefinition[];
  appliedCount: number;
  onApply: (next: DocumentFilterSheetApply) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const rowClasses =
  'flex h-11 w-full items-center gap-2.5 px-3 text-left text-panel transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent';

export function DocumentFilterSheet({
  applied,
  sortBy,
  status,
  filterDefinitions,
  appliedCount,
  onApply,
  onClearAll,
  onClose,
}: DocumentFilterSheetProps) {
  const formId = useId();
  const keywordId = useId();
  const sortHeadingId = useId();
  const statusHeadingId = useId();
  const { draft, setDraft, sortedDefs, dateErrors, hasErrors, setCustomValue } =
    useFilterDraft(applied, filterDefinitions);
  const [draftSort, setDraftSort] = useState<DocumentSortBy>(sortBy);
  const [draftStatus, setDraftStatus] = useState<DocumentStatus | null>(status ?? null);
  const [statusCounts, setStatusCounts] = useState<DocumentStatusCounts | null>(null);

  // Same unfiltered counts as the desktop sidebar's status filter.
  useEffect(() => {
    let isActive = true;
    documentsService
      .getStatusCounts()
      .then((counts) => {
        if (isActive) setStatusCounts(counts);
      })
      .catch(() => {
        // Counts are optional here
      });
    return () => {
      isActive = false;
    };
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (hasErrors) return;
    onApply({ filters: normaliseFilters(draft), sortBy: draftSort, status: draftStatus });
  };

  return (
    <Modal
      isOpen
      variant="sheet"
      onClose={onClose}
      title="Filter documents"
      headerAside={
        appliedCount > 0 ? (
          <span className="text-label uppercase text-ink-muted tabular-nums">
            {formatCount(appliedCount)} applied
          </span>
        ) : undefined
      }
      bodyClassName="px-4 pt-3 pb-4"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <TextAction tone="accent" onClick={onClearAll}>
            Clear all
          </TextAction>
          <Button
            type="submit"
            form={formId}
            variant="dark"
            disabled={hasErrors}
            className="max-md:h-12 max-md:px-6"
          >
            Apply filters
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">
        <section aria-labelledby={sortHeadingId} className="flex flex-col gap-1">
          <h3 id={sortHeadingId} className="text-label uppercase text-ink-muted">
            Sort
          </h3>
          <div
            role="radiogroup"
            aria-labelledby={sortHeadingId}
            className="overflow-hidden rounded border border-line"
          >
            {DOCUMENT_SORT_OPTIONS.map((option) => {
              const isSelected = option.value === draftSort;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setDraftSort(option.value)}
                  className={`${rowClasses} border-b border-line last:border-b-0 ${
                    isSelected ? 'bg-selected font-medium text-ink' : 'font-normal text-ink-body'
                  }`}
                >
                  <span
                    className="material-symbols-outlined w-5 shrink-0 text-[20px] leading-none text-accent"
                    aria-hidden="true"
                  >
                    {isSelected ? 'check' : ''}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby={statusHeadingId} className="flex flex-col gap-1">
          <h3 id={statusHeadingId} className="text-label uppercase text-ink-muted">
            Status
          </h3>
          <ul>
            {DOCUMENT_STATUS_ORDER.map((value) => {
              const isSelected = draftStatus === value;
              const style = documentStatusStyles[value];
              return (
                <li key={value}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setDraftStatus(isSelected ? null : value)}
                    className={`${rowClasses} rounded ${
                      isSelected
                        ? 'bg-selected font-medium text-ink'
                        : 'font-normal text-ink-body hover:bg-subtle'
                    }`}
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${style.dotClassName}`}
                      aria-hidden="true"
                    />
                    <span className="flex-1">{style.label}</span>
                    {statusCounts && (
                      <span className="text-body text-ink-muted tabular-nums">
                        {formatCount(statusCounts[value])}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <FormField label="Search keywords" htmlFor={keywordId}>
          <Input
            id={keywordId}
            type="search"
            placeholder="File name or document text"
            value={draft.keyword}
            onChange={(e) => setDraft((prev) => ({ ...prev, keyword: e.target.value }))}
          />
        </FormField>

        {sortedDefs.map((def) => {
          const raw = draft.customFilters[def.id] ?? {};
          const fieldId = `sheet-filter-${def.id}`;

          if (def.type === 'DATE') {
            const dateError = dateErrors[def.id];
            return (
              <FormField key={def.id} label={def.name} error={dateError}>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      type="date"
                      aria-label={`${def.name} from`}
                      invalid={Boolean(dateError)}
                      value={raw.from ?? ''}
                      onChange={(e) => setCustomValue(def.id, { from: e.target.value })}
                    />
                  </div>
                  <span className="text-small text-ink-muted">to</span>
                  <div className="min-w-0 flex-1">
                    <Input
                      type="date"
                      aria-label={`${def.name} to`}
                      invalid={Boolean(dateError)}
                      value={raw.to ?? ''}
                      onChange={(e) => setCustomValue(def.id, { to: e.target.value })}
                    />
                  </div>
                </div>
              </FormField>
            );
          }

          return (
            <FormField key={def.id} label={def.name} htmlFor={fieldId}>
              <Input
                id={fieldId}
                type={def.type === 'NUMBER' ? 'number' : 'text'}
                inputMode={def.type === 'NUMBER' ? 'decimal' : undefined}
                placeholder={
                  def.type === 'NUMBER' ? 'e.g. 500' : `Enter ${def.name.toLowerCase()}`
                }
                value={raw.value ?? ''}
                onChange={(e) => setCustomValue(def.id, { value: e.target.value })}
              />
            </FormField>
          );
        })}
      </form>
    </Modal>
  );
}
