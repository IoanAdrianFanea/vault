/*
Draft state for the document filter forms: edits stay local until Apply, and
date ranges are checked so the end date isn't before the start date. Shared by
the desktop filter popover and the phone filter sheet.
*/


import { useState } from 'react';
import type { CustomFilterQueryValue } from '../../api/documents';
import type { FilterDefinition } from '../../api/filters';
import { sortFilterDefinitions, type AppliedFilters } from './documentFilters';

export function useFilterDraft(applied: AppliedFilters, filterDefinitions: FilterDefinition[]) {
  const [draft, setDraft] = useState<AppliedFilters>(applied);

  const sortedDefs = sortFilterDefinitions(filterDefinitions);

  const dateErrors: Record<string, string> = {};
  for (const def of sortedDefs) {
    if (def.type === 'DATE') {
      const entry = draft.customFilters[def.id];
      const from = entry?.from?.trim();
      const to = entry?.to?.trim();
      if (from && to && from > to) {
        dateErrors[def.id] = 'The end date is before the start date.';
      }
    }
  }

  const hasErrors = Object.keys(dateErrors).length > 0;

  const setCustomValue = (filterId: string, patch: Partial<CustomFilterQueryValue>) => {
    setDraft((prev) => {
      const merged = { ...prev.customFilters[filterId], ...patch };
      const nextCustom = { ...prev.customFilters };
      if (
        (merged.value && merged.value.trim().length > 0) ||
        (merged.from && merged.from.trim().length > 0) ||
        (merged.to && merged.to.trim().length > 0)
      ) {
        nextCustom[filterId] = merged;
      } else {
        delete nextCustom[filterId];
      }
      return { ...prev, customFilters: nextCustom };
    });
  };

  return { draft, setDraft, sortedDefs, dateErrors, hasErrors, setCustomValue };
}
