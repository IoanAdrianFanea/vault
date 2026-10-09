/*
Client for the admin user-management endpoints: list, search, create, edit and
delete users, change roles and approve or reject account requests. Also provides
bulk helpers that tolerate partial failures.
*/


import { apiFetch, readErrorMessage } from './http';

export type AccountStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

export interface UserSummary {
  id: string;
  email: string;
  fullName: string | null;
  role: 'USER' | 'ADMIN';
  accountStatus: AccountStatus;
  createdAt: string;
}

export type UserWithStatus = UserSummary;

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
}

export async function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  const response = await apiFetch('/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? 'Failed to create user');
  }

  return response.json();
}

export async function searchUsers(q: string): Promise<UserSummary[]> {
  const params = new URLSearchParams({ q });
  const response = await apiFetch(`/users/search?${params}`);

  if (!response.ok) {
    throw new Error('Failed to search users');
  }

  return response.json();
}

export async function findAllUsers(): Promise<UserSummary[]> {
  const response = await apiFetch('/users');

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

export async function setUserRole(userId: string, role: 'USER' | 'ADMIN'): Promise<UserSummary> {
  const response = await apiFetch(`/users/${encodeURIComponent(userId)}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to update user role'));
  }

  return response.json();
}

export async function deleteUser(userId: string): Promise<void> {
  const response = await apiFetch(`/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to delete user'));
  }
}

export async function getPendingUsers(): Promise<UserWithStatus[]> {
  const response = await apiFetch('/users/pending');

  if (!response.ok) throw new Error('Failed to fetch pending users');
  return response.json();
}

export async function getRejectedUsers(): Promise<UserWithStatus[]> {
  const response = await apiFetch('/users/rejected');

  if (!response.ok) throw new Error('Failed to fetch rejected users');
  return response.json();
}

export async function updateUserAccountStatus(
  userId: string,
  status: AccountStatus,
): Promise<UserWithStatus> {
  const response = await apiFetch(`/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? 'Failed to update account status');
  }

  return response.json();
}

export interface AdminEditUserPayload {
  fullName?: string;
  email?: string;
  password?: string;
}

export async function adminEditUser(userId: string, payload: AdminEditUserPayload): Promise<UserSummary> {
  const response = await apiFetch(`/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? 'Failed to update user');
  }

  return response.json();
}

// Bulk helpers — use allSettled so partial failures are handled gracefully

export async function bulkDeleteUsers(
  ids: string[],
): Promise<{ succeeded: string[]; failed: number; firstError?: string }> {
  const results = await Promise.allSettled(ids.map((id) => deleteUser(id)));
  const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
  const firstRejected = results.find(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  );
  const reason = firstRejected?.reason;
  return {
    succeeded,
    failed: results.filter((r) => r.status === 'rejected').length,
    ...(reason instanceof Error ? { firstError: reason.message } : {}),
  };
}

export async function bulkUpdateAccountStatus(
  ids: string[],
  status: AccountStatus,
): Promise<{ updated: UserWithStatus[]; succeededIds: string[]; failed: number }> {
  const results = await Promise.allSettled(ids.map((id) => updateUserAccountStatus(id, status)));
  const updated: UserWithStatus[] = [];
  const succeededIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      updated.push(r.value);
      succeededIds.push(ids[i]);
    }
  });
  return { updated, succeededIds, failed: results.filter((r) => r.status === 'rejected').length };
}
