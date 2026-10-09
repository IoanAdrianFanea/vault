/*
Row of removable chips showing the filters currently applied to the documents
list, with a clear-all action.
*/


import { Chip, TextAction } from '../ui';
import type { FilterChip } from './documentFilters';

export interface DocumentFilterChipsProps {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

export function DocumentFilterChips({
  chips,
  onRemove,
  onClearAll,
}: DocumentFilterChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Active filters"
      className="flex shrink-0 flex-wrap items-center gap-1.5"
    >
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          value={chip.value}
          onRemove={() => onRemove(chip.key)}
        />
      ))}
      <TextAction tone="accent" className="ml-1" onClick={onClearAll}>
        Clear all
      </TextAction>
    </div>
  );
}
