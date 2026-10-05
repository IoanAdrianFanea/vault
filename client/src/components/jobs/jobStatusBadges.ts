import type { JobStatus } from '../../types';
import type { BadgeTone } from '../ui';

export const JOB_STATUS_BADGES: Record<
  JobStatus,
  { label: string; tone: BadgeTone }
> = {
  COMPLETED: { label: 'Completed', tone: 'teal' },
  PROCESSING: { label: 'Processing', tone: 'amber' },
  PENDING: { label: 'Pending', tone: 'amber' },
  FAILED: { label: 'Failed', tone: 'red' },
};
