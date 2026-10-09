/*
Toolbar for the documents page with the project selector, filter popover, sort
control, result count and export menu. Admins also get a shortcut to manage
projects.
*/


import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../../api/projects';
import type { FilterDefinition } from '../../api/filters';
import {
  Dropdown,
  Menu,
  textActionClassName,
  type DropdownOption,
  type MenuItem,
} from '../ui';
import {
  ALL_PROJECTS,
  DOCUMENT_SORT_OPTIONS,
  type AppliedFilters,
  type DocumentSortBy,
} from './documentFilters';
import { DocumentFilterPopover } from './DocumentFilterPopover';

export interface DocumentsToolbarProps {
  projects: Project[];
  isAdmin: boolean;
  applied: AppliedFilters;
  filterDefinitions: FilterDefinition[];
  appliedFilterCount: number;
  sortBy: DocumentSortBy;
  countLabel: string | null;
  exportItems: MenuItem[];
  onProjectChange: (projectId: string) => void;
  onApplyFilters: (next: AppliedFilters) => void;
  onClearPopoverFilters: () => void;
  onSortChange: (sortBy: DocumentSortBy) => void;
}

export function DocumentsToolbar({
  projects,
  isAdmin,
  applied,
  filterDefinitions,
  appliedFilterCount,
  sortBy,
  countLabel,
  exportItems,
  onProjectChange,
  onApplyFilters,
  onClearPopoverFilters,
  onSortChange,
}: DocumentsToolbarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const projectOptions: DropdownOption<string>[] = [
    { value: ALL_PROJECTS, label: 'All projects' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const projectFooter = isAdmin ? (
    <Link
      to="/admin/projects"
      className={textActionClassName('accent', 'label', 'flex h-7 items-center px-2')}
    >
      Manage projects
    </Link>
  ) : undefined;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          label="Project"
          value={applied.projectId}
          options={projectOptions}
          onChange={onProjectChange}
          footer={projectFooter}
        />

        <DocumentFilterPopover
          isOpen={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          applied={applied}
          projects={projects}
          filterDefinitions={filterDefinitions}
          appliedCount={appliedFilterCount}
          onApply={onApplyFilters}
          onClearAll={onClearPopoverFilters}
        />

        <Dropdown
          label="Sort"
          value={sortBy}
          options={DOCUMENT_SORT_OPTIONS}
          onChange={onSortChange}
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {countLabel && (
          <span className="text-small text-ink-muted tabular-nums" aria-live="polite">
            {countLabel}
          </span>
        )}
        <Menu label="Export" icon="download" items={exportItems} align="end" />
      </div>
    </div>
  );
}
