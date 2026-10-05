import type { BadgeTone } from '../components/ui';
import type { AccountStatus } from '../api/users';

export const ROLE_BADGES: Record<'ADMIN' | 'USER', { label: string; tone: BadgeTone }> = {
  ADMIN: { label: 'Admin', tone: 'teal' },
  USER: { label: 'User', tone: 'slate' },
};

export const ACCOUNT_STATUS_BADGES: Record<AccountStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Active', tone: 'teal' },
  PENDING: { label: 'Pending', tone: 'amber' },
  REJECTED: { label: 'Rejected', tone: 'red' },
};

export function roleBadge(role: string): { label: string; tone: BadgeTone } {
  return role === 'ADMIN' ? ROLE_BADGES.ADMIN : ROLE_BADGES.USER;
}
