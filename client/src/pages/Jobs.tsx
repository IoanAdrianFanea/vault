/*
Preview page for background jobs, showing sample data in a table with a detail
drawer. It is not routed yet and is kept for Phase 6, when the backend has job
processing.
*/


import { useParams, useNavigate } from 'react-router-dom';
import type { Job } from '../types';
import { JobsTable } from '../components/jobs/JobsTable';
import { JobDrawer } from '../components/jobs/JobDrawer';
import { EmptyState, InlineAlert, PageHeader } from '../components/ui';

// Mock data
const mockJobs: Job[] = [
  {
    id: '8291',
    type: 'EXPORT',
    title: 'Export PDF Bundle',
    status: 'COMPLETED',
    createdAt: '2026-10-26T10:23:00',
    createdBy: 'Sarah M.',
    completedAt: '2026-10-26T10:25:00',
    duration: '2m 14s',
    fileSize: '45.2 MB',
    fileCount: 18,
  },
  {
    id: '8292',
    type: 'INDEX',
    title: 'Index Site Plans',
    status: 'PROCESSING',
    createdAt: '2026-10-26T09:45:00',
    createdBy: 'System',
    fileCount: 12,
  },
  {
    id: '8288',
    type: 'EXTRACT',
    title: 'Export Daily Logs',
    status: 'FAILED',
    createdAt: '2026-10-25T16:15:00',
    createdBy: 'Mike R.',
    errorMessage: 'Insufficient permissions to access log directory',
  },
  {
    id: '8285',
    type: 'INDEX',
    title: 'Index Safety Reports',
    status: 'COMPLETED',
    createdAt: '2026-10-25T14:00:00',
    createdBy: 'Sarah M.',
    completedAt: '2026-10-25T14:15:00',
    duration: '15m 23s',
  },
  {
    id: '8280',
    type: 'EXPORT',
    title: 'Export Blueprints',
    status: 'COMPLETED',
    createdAt: '2026-10-24T11:30:00',
    createdBy: 'Admin',
    completedAt: '2026-10-24T11:35:00',
    duration: '5m 12s',
    fileSize: '89.7 MB',
  },
];

export default function Jobs() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const selectedJob = id ? mockJobs.find((j) => j.id === id) ?? null : null;

  const handleSelectJob = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

  const handleCloseDrawer = () => {
    navigate('/jobs');
  };

  const handleRetryJob = (_jobId: string) => {
    void _jobId;
    // TODO(backend): endpoint to re-run a failed job.
  };

  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pt-3 pb-4">
          <PageHeader
            title="Jobs"
            description="Exports, indexing and text extraction runs."
          />
          <InlineAlert tone="info">
            Preview — jobs and background processing arrive in Phase 6. This page
            shows sample data.
          </InlineAlert>
          {mockJobs.length === 0 ? (
            <EmptyState icon="work_history" title="No jobs yet" />
          ) : (
            <JobsTable
              jobs={mockJobs}
              selectedJobId={selectedJob?.id}
              onSelectJob={handleSelectJob}
              onRetryJob={handleRetryJob}
            />
          )}
        </div>
      </main>
      {selectedJob && (
        <JobDrawer job={selectedJob} onClose={handleCloseDrawer} />
      )}
    </>
  );
}
