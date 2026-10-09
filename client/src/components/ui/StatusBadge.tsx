/*
Badge showing a document's processing status. A failed status shows its error
message on hover.
*/


import type { DocumentStatus } from '../../types';
import { Badge } from './Badge';
import { documentStatusStyles } from './statusTones';

export interface StatusBadgeProps {
  status: DocumentStatus;
  errorMessage?: string;
}

export function StatusBadge({ status, errorMessage }: StatusBadgeProps) {
  const style = documentStatusStyles[status];

  return (
    <Badge
      tone={style.badgeTone}
      dot
      title={status === 'FAILED' ? errorMessage : undefined}
    >
      {style.label}
    </Badge>
  );
}
