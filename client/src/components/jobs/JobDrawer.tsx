import { useState } from 'react';
import type { Job } from '../../types';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  InlineAlert,
} from '../ui';
import { formatCount, formatDateTime } from '../../utils/format';
import { JOB_STATUS_BADGES } from './jobStatusBadges';

export interface JobDrawerProps {
  job: Job;
  onClose: () => void;
}

const DEFAULT_SAMPLE_FILES = [
  'Site_A_Floor_Plan_L1.pdf',
  'Site_A_Floor_Plan_L2.pdf',
  'Electrical_Schematics_v4.pdf',
];

export function JobDrawer({ job, onClose }: JobDrawerProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const statusInfo = JOB_STATUS_BADGES[job.status];
  const filesList = job.files && job.files.length > 0 ? job.files : DEFAULT_SAMPLE_FILES;
  const totalFileCount = job.fileCount ?? filesList.length;

  const displayedFiles = filesList.slice(0, 3);
  const remainingCount = totalFileCount - displayedFiles.length;

  const handleDownloadJob = () => {
    // TODO(backend): endpoint to download a completed job's ZIP output.
  };

  const handleDeleteJob = (_jobId: string) => {
    void _jobId;
    // TODO(backend): endpoint to delete a job and its output.
  };

  return (
    <>
      <Drawer
        title={job.title}
        description={`#${job.id}`}
        headerAside={
          <Badge tone={statusInfo.tone} dot>
            {statusInfo.label}
          </Badge>
        }
        onClose={onClose}
        footer={
          <Button
            variant="danger"
            icon="delete"
            onClick={() => setIsDeleteOpen(true)}
          >
            Delete job
          </Button>
        }
      >
        <div className="space-y-4">
          {job.status === 'COMPLETED' && (
            <div className="rounded border border-line bg-subtle p-3">
              <p className="text-body font-medium text-ink">
                Ready for download
              </p>
              <p className="text-small text-ink-muted">
                File size: {job.fileSize ?? '—'}
              </p>
              <Button
                variant="primary"
                size="sm"
                icon="folder_zip"
                className="mt-2"
                onClick={handleDownloadJob}
              >
                Download ZIP
              </Button>
            </div>
          )}

          {job.status === 'FAILED' && (
            <InlineAlert tone="error">
              <p className="font-medium">Job failed</p>
              {job.errorMessage && <p>{job.errorMessage}</p>}
            </InlineAlert>
          )}

          <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1.5 text-body">
            <dt className="text-label uppercase text-ink-muted">Started by</dt>
            <dd className="text-ink">
              <div className="flex items-center gap-1.5">
                <Avatar size="sm" fullName={job.createdBy} />
                <span className="truncate">{job.createdBy}</span>
              </div>
            </dd>

            <dt className="text-label uppercase text-ink-muted">Duration</dt>
            <dd className="text-ink tabular-nums">{job.duration ?? '—'}</dd>

            <dt className="text-label uppercase text-ink-muted">Started</dt>
            <dd className="text-ink tabular-nums">
              {formatDateTime(job.createdAt)}
            </dd>

            <dt className="text-label uppercase text-ink-muted">Finished</dt>
            <dd className="text-ink tabular-nums">
              {job.completedAt ? formatDateTime(job.completedAt) : '—'}
            </dd>
          </dl>

          <div>
            <h3 className="text-label uppercase text-ink-muted mb-1.5">
              Included files ({formatCount(totalFileCount)})
            </h3>
            <ul className="divide-y divide-line rounded border border-line">
              {displayedFiles.map((filename, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 px-3 py-2 text-small text-ink"
                >
                  <span
                    className="material-symbols-outlined text-[16px] text-ink-muted"
                    aria-hidden="true"
                  >
                    description
                  </span>
                  <span className="truncate" title={filename}>
                    {filename}
                  </span>
                </li>
              ))}
            </ul>
            {remainingCount > 0 && (
              <p className="mt-1 text-small text-ink-muted">
                and {remainingCount} more
              </p>
            )}
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete this job?"
        message={`"${job.title}" will be removed from the jobs list.`}
        confirmLabel="Delete"
        onConfirm={() => {
          handleDeleteJob(job.id);
          setIsDeleteOpen(false);
        }}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </>
  );
}
