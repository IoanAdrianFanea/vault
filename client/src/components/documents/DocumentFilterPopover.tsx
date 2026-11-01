/*
Popover form for filtering documents by keyword, project and the admin-defined
custom fields, with date range validation. Edits a draft and applies it only on
submit.
*/


import { useId, type FormEvent } from 'react';
import type { FilterDefinition } from '../../api/filters';
import type { Project } from '../../api/projects';
import { Badge, Button, FormField, Input, Popover, Select } from '../ui';
import {
  ALL_PROJECTS,
  normaliseFilters,
  type AppliedFilters,
} from './documentFilters';
import { useFilterDraft } from './useFilterDraft';

export interface DocumentFilterPopoverProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  applied: AppliedFilters;
  projects: Project[];
  filterDefinitions: FilterDefinition[];
  appliedCount: number;
  onApply: (next: AppliedFilters) => void;
  onClearAll: () => void;
}

interface FilterPanelProps {
  applied: AppliedFilters;
  projects: Project[];
  filterDefinitions: FilterDefinition[];
  appliedCount: number;
  onApply: (next: AppliedFilters) => void;
  onClearAll: () => void;
}

function FilterPanel({
  applied,
  projects,
  filterDefinitions,
  appliedCount,
  onApply,
  onClearAll,
}: FilterPanelProps) {
  const { draft, setDraft, sortedDefs, dateErrors, hasErrors, setCustomValue } =
    useFilterDraft(applied, filterDefinitions);
  const keywordId = useId();
  const projectFieldId = useId();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!hasErrors) {
      onApply(normaliseFilters(draft));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-body font-semibold text-ink">Filter documents</h2>
        {appliedCount > 0 && (
          <span className="text-label uppercase text-ink-muted tabular-nums">
            {appliedCount} applied
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Search keywords" htmlFor={keywordId} className="col-span-2">
          <Input
            id={keywordId}
            size="sm"
            leadingIcon="search"
            placeholder="File name or document text"
            value={draft.keyword}
            onChange={(e) => setDraft((prev) => ({ ...prev, keyword: e.target.value }))}
          />
        </FormField>

        <FormField label="Project" htmlFor={projectFieldId}>
          <Select
            id={projectFieldId}
            size="sm"
            value={draft.projectId}
            onChange={(e) => setDraft((prev) => ({ ...prev, projectId: e.target.value }))}
          >
            <option value={ALL_PROJECTS}>All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>

        {sortedDefs.map((def) => {
          const raw = draft.customFilters[def.id] ?? {};
          const fieldId = `custom-filter-${def.id}`;

          if (def.type === 'DATE') {
            const dateError = dateErrors[def.id];
            return (
              <FormField
                key={def.id}
                label={def.name}
                error={dateError}
                className="col-span-2"
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    size="sm"
                    aria-label="From"
                    invalid={Boolean(dateError)}
                    value={raw.from ?? ''}
                    onChange={(e) => setCustomValue(def.id, { from: e.target.value })}
                  />
                  <span className="text-small text-ink-muted">to</span>
                  <Input
                    type="date"
                    size="sm"
                    aria-label="To"
                    invalid={Boolean(dateError)}
                    value={raw.to ?? ''}
                    onChange={(e) => setCustomValue(def.id, { to: e.target.value })}
                  />
                </div>
              </FormField>
            );
          }

          return (
            <FormField key={def.id} label={def.name} htmlFor={fieldId}>
              <Input
                id={fieldId}
                size="sm"
                type={def.type === 'NUMBER' ? 'number' : 'text'}
                placeholder={
                  def.type === 'NUMBER' ? 'e.g. 500' : `Enter ${def.name.toLowerCase()}`
                }
                value={raw.value ?? ''}
                onChange={(e) => setCustomValue(def.id, { value: e.target.value })}
              />
            </FormField>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          Clear all
        </Button>
        <Button type="submit" variant="dark" size="sm" disabled={hasErrors}>
          Apply filters
        </Button>
      </div>
    </form>
  );
}

export function DocumentFilterPopover({
  isOpen,
  onOpenChange,
  applied,
  projects,
  filterDefinitions,
  appliedCount,
  onApply,
  onClearAll,
}: DocumentFilterPopoverProps) {
  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label="Filter documents"
      kind="dialog"
      align="start"
      panelClassName="w-[520px] p-3"
      renderTrigger={(triggerProps) => (
        <Button
          {...triggerProps}
          variant="secondary"
          size="sm"
          icon="tune"
          aria-label={appliedCount > 0 ? `Filter, ${appliedCount} applied` : undefined}
        >
          Filter
          {appliedCount > 0 && <Badge tone="teal">{appliedCount}</Badge>}
        </Button>
      )}
    >
      {({ close }) => (
        <FilterPanel
          applied={applied}
          projects={projects}
          filterDefinitions={filterDefinitions}
          appliedCount={appliedCount}
          onApply={(next) => {
            onApply(next);
            close();
          }}
          onClearAll={() => {
            onClearAll();
            close();
          }}
        />
      )}
    </Popover>
  );
}
