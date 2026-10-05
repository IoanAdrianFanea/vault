import { Button, IconButton } from '../ui';
import { formatCount } from '../../utils/format';

export interface BulkActionBarProps {
  selectedCount: number;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
  onExportCsv?: () => void;
}

export function BulkActionBar({
  selectedCount,
  onExport,
  onDelete,
  onClear,
  onExportCsv,
}: BulkActionBarProps) {
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

      <Button variant="inverse" size="sm" icon="folder_zip" onClick={onExport}>
        Download ZIP
      </Button>

      {onExportCsv && (
        <Button variant="inverse" size="sm" icon="table_view" onClick={onExportCsv}>
          Export CSV
        </Button>
      )}

      <Button variant="inverse" size="sm" icon="delete" onClick={onDelete}>
        Delete
      </Button>

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
