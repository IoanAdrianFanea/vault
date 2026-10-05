import type { Job, JobType } from '../../types';
import {
  Badge,
  DataTable,
  TableCell,
  TableHeaderCell,
  TableRow,
  TextAction,
} from '../ui';
import { formatCountLabel, formatDateTime } from '../../utils/format';
import { JOB_STATUS_BADGES } from './jobStatusBadges';

function getTypeIcon(type: JobType): string {
  switch (type) {
    case 'EXPORT':
      return 'picture_as_pdf';
    case 'INDEX':
      return 'content_copy';
    case 'EXTRACT':
      return 'summarize';
  }
}

export interface JobsTableProps {
  jobs: Job[];
  selectedJobId?: string;
  onSelectJob: (id: string) => void;
  onRetryJob: (id: string) => void;
}

export function JobsTable({
  jobs,
  selectedJobId,
  onSelectJob,
  onRetryJob,
}: JobsTableProps) {
  return (
    <DataTable label="Jobs" fixed>
      <thead>
        <TableRow>
          <TableHeaderCell>Job</TableHeaderCell>
          <TableHeaderCell className="w-[120px]">Status</TableHeaderCell>
          <TableHeaderCell className="w-[170px]">Created</TableHeaderCell>
          <TableHeaderCell align="end" className="w-[120px]">
            Actions
          </TableHeaderCell>
        </TableRow>
      </thead>
      <tbody>
        {jobs.map((job) => {
          const isSelected = job.id === selectedJobId;
          const statusInfo = JOB_STATUS_BADGES[job.status];
          const isFailed = job.status === 'FAILED';

          return (
            <TableRow
              key={job.id}
              selected={isSelected}
              onClick={() => onSelectJob(job.id)}
            >
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span
                    className="material-symbols-outlined text-[16px] text-ink-muted"
                    aria-hidden="true"
                  >
                    {getTypeIcon(job.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className="block truncate font-medium text-ink"
                      title={job.title}
                    >
                      {job.title}
                    </span>
                    <span className="block text-small text-ink-muted tabular-nums">
                      {`#${job.id} · ${
                        job.fileSize ??
                        formatCountLabel(job.fileCount ?? 0, 'file', 'files')
                      }`}
                    </span>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <Badge tone={statusInfo.tone} dot>
                  {statusInfo.label}
                </Badge>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-small text-ink tabular-nums">
                  {formatDateTime(job.createdAt)}
                </span>
                <span className="block text-small text-ink-muted">
                  by {job.createdBy}
                </span>
              </TableCell>

              <TableCell align="end" onClick={(e) => e.stopPropagation()}>
                <div className="inline-flex items-center gap-1.5">
                  {isFailed && (
                    <>
                      <TextAction
                        tone="danger"
                        aria-label={`Retry ${job.title}`}
                        onClick={() => onRetryJob(job.id)}
                      >
                        Retry
                      </TextAction>
                      <span
                        className="text-small text-line-strong"
                        aria-hidden="true"
                      >
                        /
                      </span>
                    </>
                  )}
                  <TextAction
                    tone="accent"
                    aria-label={`View ${job.title}`}
                    onClick={() => onSelectJob(job.id)}
                  >
                    View
                  </TextAction>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </tbody>
    </DataTable>
  );
}
