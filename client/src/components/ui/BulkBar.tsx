/*
Floating bar shown at the bottom of the screen while rows are selected, with the
selected count, caller-supplied actions and a clear button.
*/


import { Button } from './Button';
import { IconButton } from './IconButton';
import { formatCount } from '../../utils/format';

export interface BulkBarAction {
  key: string;
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface BulkBarProps {
  selectedCount: number;
  actions: BulkBarAction[];
  onClear: () => void;
  busy?: boolean;
}

export function BulkBar({
  selectedCount,
  actions,
  onClear,
  busy = false,
}: BulkBarProps) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed bottom-6 left-1/2 z-bulkbar flex -translate-x-1/2 items-center gap-1 rounded-md bg-action py-1 pl-3 pr-1 text-white shadow-overlay"
    >
      <span className="text-body font-medium tabular-nums" aria-live="polite">
        {formatCount(selectedCount)} selected
      </span>

      <span className="mx-2 h-5 w-px bg-white/20" aria-hidden="true" />

      {actions.map((action) => (
        <Button
          key={action.key}
          variant="inverse"
          size="sm"
          icon={action.icon}
          disabled={action.disabled || busy}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}

      <span className="mx-1 h-5 w-px bg-white/20" aria-hidden="true" />

      <IconButton
        variant="inverse"
        size="sm"
        icon="close"
        label="Clear selection"
        onClick={onClear}
      />
    </div>
  );
}
