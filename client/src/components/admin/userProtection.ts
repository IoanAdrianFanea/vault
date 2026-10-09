/*
Rules that stop an admin deleting or demoting their own account, or the last
active admin. Returns the reason to show when the action is blocked, for the
admin users list.
*/


import type { UserSummary } from '../../api/users';

export const OWN_ACCOUNT_DELETE_REASON = "You can't delete your own account";
export const OWN_ROLE_REASON = "You can't change your own role";
export const LAST_ADMIN_REASON = 'At least one admin is required';

export function countActiveAdmins(users: UserSummary[]): number {
  return users.filter((u) => u.role === 'ADMIN' && u.accountStatus === 'ACTIVE').length;
}

export function getUserProtection(
  user: UserSummary,
  currentUserId: string | null,
  activeAdminCount: number,
): { deleteBlockedReason: string | null; roleBlockedReason: string | null } {
  if (user.id === currentUserId) {
    return {
      deleteBlockedReason: OWN_ACCOUNT_DELETE_REASON,
      roleBlockedReason: OWN_ROLE_REASON,
    };
  }
  if (user.role === 'ADMIN' && user.accountStatus === 'ACTIVE' && activeAdminCount <= 1) {
    return { deleteBlockedReason: LAST_ADMIN_REASON, roleBlockedReason: LAST_ADMIN_REASON };
  }
  return { deleteBlockedReason: null, roleBlockedReason: null };
}
