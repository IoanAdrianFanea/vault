/*
Filter and sort state logic for the documents page: applied-filter types,
normalising and counting filters, building the removable filter chips and
converting state into an API query. Also remembers the selected project for the
browser session.
*/


import type {
  CustomFilterQueryValue,
  DocumentStatus,
  DocumentStatusCounts,
  ListDocumentsFilters,
} from '../../api/documents';
import type { FilterDefinition } from '../../api/filters';
import type { DropdownOption } from '../ui';
import { documentStatusStyles } from '../ui';
import { formatIsoDate } from '../../utils/format';

export const ALL_PROJECTS = 'all';
export const PROJECT_STORAGE_KEY = 'documents:selectedProject';
// Matches the server's take: 50 in DocumentsService.listDocuments.
export const DOCUMENT_LIST_LIMIT = 50;

export type DocumentSortBy = NonNullable<ListDocumentsFilters['sortBy']>;

export interface AppliedFilters {
  projectId: string;
  keyword: string;
  customFilters: Record<string, CustomFilterQueryValue>;
}

export interface FilterChip {
  key: string;
  label: string;
  value: string;
}

export const DOCUMENT_SORT_OPTIONS: DropdownOption<DocumentSortBy>[] = [
  { value: 'upload-newest', label: 'Date uploaded (newest)' },
  { value: 'upload-oldest', label: 'Date uploaded (oldest)' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'status', label: 'Status' },
];

export function readStoredProjectId(): string {
  try {
    const stored = sessionStorage.getItem(PROJECT_STORAGE_KEY);
    if (!stored || stored === 'All Projects') {
      return ALL_PROJECTS;
    }
    return stored;
  } catch {
    return ALL_PROJECTS;
  }
}

export function writeStoredProjectId(projectId: string): void {
  try {
    sessionStorage.setItem(PROJECT_STORAGE_KEY, projectId);
  } catch {
    // Ignore storage failure
  }
}

export function createEmptyFilters(projectId: string = ALL_PROJECTS): AppliedFilters {
  return {
    projectId,
    keyword: '',
    customFilters: {},
  };
}

export function sortFilterDefinitions(definitions: FilterDefinition[]): FilterDefinition[] {
  return [...definitions].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.name.localeCompare(b.name);
  });
}

export function normaliseFilters(filters: AppliedFilters): AppliedFilters {
  const trimmedKeyword = filters.keyword.trim();
  const nextCustom: Record<string, CustomFilterQueryValue> = {};

  for (const [id, entry] of Object.entries(filters.customFilters)) {
    const val = entry.value?.trim();
    const from = entry.from?.trim();
    const to = entry.to?.trim();

    const cleaned: CustomFilterQueryValue = {};
    if (val) cleaned.value = val;
    if (from) cleaned.from = from;
    if (to) cleaned.to = to;

    if (cleaned.value || cleaned.from || cleaned.to) {
      nextCustom[id] = cleaned;
    }
  }

  return {
    projectId: filters.projectId,
    keyword: trimmedKeyword,
    customFilters: nextCustom,
  };
}

export function countAppliedFilters(
  filters: AppliedFilters,
  definitions: FilterDefinition[],
): number {
  let count = 0;
  if (filters.projectId !== ALL_PROJECTS) count++;
  if (filters.keyword.trim().length > 0) count++;

  for (const def of definitions) {
    const entry = filters.customFilters[def.id];
    if (entry && (entry.value || entry.from || entry.to)) {
      count++;
    }
  }

  return count;
}

export function hasActiveFilters(
  filters: AppliedFilters,
  status: DocumentStatus | undefined,
): boolean {
  if (status) return true;
  if (filters.projectId !== ALL_PROJECTS) return true;
  if (filters.keyword.trim().length > 0) return true;

  for (const entry of Object.values(filters.customFilters)) {
    if (entry && (entry.value || entry.from || entry.to)) {
      return true;
    }
  }

  return false;
}

export function buildFilterChips(args: {
  filters: AppliedFilters;
  projectName: string | null;
  definitions: FilterDefinition[];
  status: DocumentStatus | undefined;
}): FilterChip[] {
  const { filters, projectName, definitions, status } = args;
  const chips: FilterChip[] = [];

  if (filters.projectId !== ALL_PROJECTS) {
    chips.push({
      key: 'project',
      label: 'Project',
      value: projectName ?? 'Unknown project',
    });
  }

  if (filters.keyword.trim().length > 0) {
    chips.push({
      key: 'keyword',
      label: 'Keyword',
      value: filters.keyword.trim(),
    });
  }

  const sortedDefs = sortFilterDefinitions(definitions);
  for (const def of sortedDefs) {
    const entry = filters.customFilters[def.id];
    if (!entry) continue;

    if (def.type === 'DATE') {
      const from = entry.from?.trim();
      const to = entry.to?.trim();
      if (from && to) {
        chips.push({
          key: `custom:${def.id}`,
          label: def.name,
          value: `${formatIsoDate(from)} – ${formatIsoDate(to)}`,
        });
      } else if (from) {
        chips.push({
          key: `custom:${def.id}`,
          label: def.name,
          value: `From ${formatIsoDate(from)}`,
        });
      } else if (to) {
        chips.push({
          key: `custom:${def.id}`,
          label: def.name,
          value: `Until ${formatIsoDate(to)}`,
        });
      }
    } else {
      const val = entry.value?.trim();
      if (val) {
        chips.push({
          key: `custom:${def.id}`,
          label: def.name,
          value: val,
        });
      }
    }
  }

  if (status) {
    chips.push({
      key: 'status',
      label: 'Status',
      value: documentStatusStyles[status].label,
    });
  }

  return chips;
}

export function toListQuery(
  filters: AppliedFilters,
  status: DocumentStatus | undefined,
  sortBy: DocumentSortBy,
): ListDocumentsFilters {
  return {
    projectId: filters.projectId === ALL_PROJECTS ? undefined : filters.projectId,
    mainFilter: filters.keyword.trim() || undefined,
    customFilters:
      Object.keys(filters.customFilters).length > 0 ? filters.customFilters : undefined,
    status,
    sortBy,
  };
}

export function getMatchingTotal(
  counts: DocumentStatusCounts,
  status: DocumentStatus | undefined,
): number {
  if (status) {
    return counts[status] ?? 0;
  }
  return (
    counts.UPLOADED +
    counts.QUEUED +
    counts.PROCESSING +
    counts.PROCESSED +
    counts.FAILED
  );
}

export function getInProgressCount(counts: DocumentStatusCounts): number {
  return counts.UPLOADED + counts.QUEUED + counts.PROCESSING;
}
