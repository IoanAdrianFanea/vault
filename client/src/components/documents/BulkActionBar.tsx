/*
Bulk action bar for the documents list, offering ZIP download, optional CSV
export and delete for the selected rows. A thin wrapper around the shared
BulkBar.
*/


import { BulkBar, type BulkBarAction } from '../ui';

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
  const actions: BulkBarAction[] = [
    { key: 'zip', label: 'Download ZIP', icon: 'folder_zip', onClick: onExport },
    ...(onExportCsv
      ? [{ key: 'csv', label: 'Export CSV', icon: 'table_view', onClick: onExportCsv }]
      : []),
    { key: 'delete', label: 'Delete', icon: 'delete', onClick: onDelete },
  ];

  return (
    <BulkBar
      selectedCount={selectedCount}
      onClear={onClear}
      actions={actions}
    />
  );
}

