import { useCallback, useEffect, useState } from 'react';
import {
  getPendingUsers,
  getRejectedUsers,
  updateUserAccountStatus,
  deleteUser,
  bulkUpdateAccountStatus,
  bulkDeleteUsers,
  type UserWithStatus,
} from '../../api/users';
import { AdminSection } from '../../components/admin/AdminSection';
import { useAdminLayout } from '../../components/admin/adminLayoutContext';
import { useRangeSelection } from '../../hooks/useRangeSelection';
import {
  Avatar,
  BulkBar,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  InlineAlert,
  SegmentedControl,
  TableCell,
  TableHeaderCell,
  TableRow,
  getTabId,
  getTabPanelId,
} from '../../components/ui';
import { formatCountLabel, formatDate } from '../../utils/format';

type Tab = 'pending' | 'rejected';

type SingleAction =
  | { type: 'reject'; user: UserWithStatus }
  | { type: 'delete'; user: UserWithStatus };

type BulkActionType = 'bulk-reject' | 'bulk-delete';

export default function AdminPending() {
  const { refreshPendingCount } = useAdminLayout();

  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<UserWithStatus[]>([]);
  const [rejected, setRejected] = useState<UserWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionAlert, setActionAlert] = useState<{
    tone: 'error' | 'warning';
    message: string;
  } | null>(null);

  const [singleConfirm, setSingleConfirm] = useState<SingleAction | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const displayList = tab === 'pending' ? pending : rejected;

  const selection = useRangeSelection(
    displayList.map((u) => u.id),
    tab,
  );

  const load = useCallback(() => {
    setIsLoading(true);
    setError('');
    Promise.all([getPendingUsers(), getRejectedUsers()])
      .then(([p, r]) => {
        setPending(p);
        setRejected(r);
      })
      .catch(() => {
        setError('Failed to load users. Please refresh the page.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (user: UserWithStatus) => {
    setActionLoading(user.id);
    try {
      await updateUserAccountStatus(user.id, 'ACTIVE');
      if (tab === 'pending') {
        setPending((prev) => prev.filter((u) => u.id !== user.id));
      } else {
        setRejected((prev) => prev.filter((u) => u.id !== user.id));
      }
      selection.retain(
        Array.from(selection.selectedIds).filter((id) => id !== user.id),
      );
      refreshPendingCount();
    } catch {
      setActionAlert({
        tone: 'error',
        message: "Couldn't approve the user. Try again.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    setBulkLoading(true);
    const ids = Array.from(selection.selectedIds);
    try {
      const res = await bulkUpdateAccountStatus(ids, 'ACTIVE');
      if (tab === 'pending') {
        setPending((prev) =>
          prev.filter((u) => !res.succeededIds.includes(u.id)),
        );
      } else {
        setRejected((prev) =>
          prev.filter((u) => !res.succeededIds.includes(u.id)),
        );
      }
      const failedIds = ids.filter((id) => !res.succeededIds.includes(id));
      selection.retain(failedIds);

      if (res.failed > 0) {
        setActionAlert({
          tone: 'warning',
          message: `${formatCountLabel(res.failed, 'account', 'accounts')} couldn't be approved.`,
        });
      }
      refreshPendingCount();
    } catch {
      setActionAlert({
        tone: 'error',
        message: 'Bulk approve failed. Please try again.',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSingleConfirm = async () => {
    if (!singleConfirm) return;
    setSingleLoading(true);
    const user = singleConfirm.user;

    try {
      if (singleConfirm.type === 'reject') {
        const updated = await updateUserAccountStatus(user.id, 'REJECTED');
        setPending((prev) => prev.filter((u) => u.id !== user.id));
        setRejected((prev) => [...prev, updated]);
      } else {
        await deleteUser(user.id);
        setRejected((prev) => prev.filter((u) => u.id !== user.id));
      }
      selection.retain(
        Array.from(selection.selectedIds).filter((id) => id !== user.id),
      );
      setSingleConfirm(null);
      refreshPendingCount();
    } catch {
      setActionAlert({ tone: 'error', message: 'Action failed. Try again.' });
    } finally {
      setSingleLoading(false);
    }
  };

  const handleBulkConfirm = async () => {
    if (!bulkAction) return;
    setBulkLoading(true);
    const ids = Array.from(selection.selectedIds);

    try {
      if (bulkAction === 'bulk-reject') {
        const res = await bulkUpdateAccountStatus(ids, 'REJECTED');
        setPending((prev) =>
          prev.filter((u) => !res.succeededIds.includes(u.id)),
        );
        setRejected((prev) => [...prev, ...res.updated]);
        const failedIds = ids.filter((id) => !res.succeededIds.includes(id));
        selection.retain(failedIds);
        if (res.failed > 0) {
          setActionAlert({
            tone: 'warning',
            message: `${formatCountLabel(res.failed, 'account', 'accounts')} couldn't be updated.`,
          });
        }
      } else {
        const res = await bulkDeleteUsers(ids);
        setRejected((prev) =>
          prev.filter((u) => !res.succeeded.includes(u.id)),
        );
        const failedIds = ids.filter((id) => !res.succeeded.includes(id));
        selection.retain(failedIds);
        if (res.failed > 0) {
          setActionAlert({
            tone: 'warning',
            message: `${formatCountLabel(res.failed, 'account', 'accounts')} couldn't be updated.`,
          });
        }
      }
      setBulkAction(null);
      refreshPendingCount();
    } catch {
      setActionAlert({
        tone: 'error',
        message: 'Bulk action failed. Please try again.',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const singleDisplayName = singleConfirm?.user
    ? singleConfirm.user.fullName || singleConfirm.user.email
    : '';

  return (
    <AdminSection
      bulkBarSpace={selection.selectedIds.size > 0}
      toolbarStart={
        <SegmentedControl
          label="Request status"
          idPrefix="pending"
          value={tab}
          onChange={setTab}
          items={[
            {
              value: 'pending',
              label: 'Pending',
              count: pending.length,
            },
            {
              value: 'rejected',
              label: 'Rejected',
              count: rejected.length,
            },
          ]}
        />
      }
    >
      {actionAlert && (
        <InlineAlert
          tone={actionAlert.tone}
          onDismiss={() => setActionAlert(null)}
        >
          {actionAlert.message}
        </InlineAlert>
      )}

      <div
        role="tabpanel"
        id={getTabPanelId('pending', tab)}
        aria-labelledby={getTabId('pending', tab)}
      >
        {error ? (
          <div className="flex flex-col items-start gap-2">
            <InlineAlert tone="error">
              <p className="font-medium">Couldn't load users.</p>
              <p>{error}</p>
            </InlineAlert>
            <Button variant="secondary" size="sm" icon="refresh" onClick={load}>
              Try again
            </Button>
          </div>
        ) : isLoading && displayList.length === 0 ? null : displayList.length === 0 ? (
          tab === 'pending' ? (
            <EmptyState
              icon="how_to_reg"
              title="No pending requests"
              description="New sign-ups will appear here for approval."
            />
          ) : (
            <EmptyState icon="person_off" title="No rejected accounts" />
          )
        ) : (
          <DataTable
            label={
              tab === 'pending' ? 'Pending requests' : 'Rejected accounts'
            }
            fixed
            busy={isLoading && displayList.length > 0}
          >
            <thead>
              <TableRow>
                <TableHeaderCell align="center" className="w-8">
                  <Checkbox
                    aria-label={`Select all ${
                      tab === 'pending' ? 'pending' : 'rejected'
                    } users`}
                    checked={selection.allSelected}
                    indeterminate={
                      selection.someSelected && !selection.allSelected
                    }
                    onChange={(e) => selection.setAll(e.target.checked)}
                  />
                </TableHeaderCell>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell className="w-[120px]">
                  Requested
                </TableHeaderCell>
                <TableHeaderCell align="end" className="w-[200px]">
                  Actions
                </TableHeaderCell>
              </TableRow>
            </thead>
            <tbody>
              {displayList.map((user) => {
                  const isSelected = selection.selectedIds.has(user.id);
                  const displayName = user.fullName || user.email;

                  return (
                    <TableRow
                      key={user.id}
                      selected={isSelected}
                      onClick={(e) => selection.toggle(user.id, e.shiftKey)}
                    >
                      <TableCell
                        align="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          aria-label={`Select ${displayName}`}
                          checked={isSelected}
                          onChange={(e) =>
                            selection.toggle(
                              user.id,
                              (e.nativeEvent as MouseEvent).shiftKey,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar
                            size="sm"
                            fullName={user.fullName}
                            email={user.email}
                          />
                          <span className="truncate">
                            {user.fullName || (
                              <span className="text-ink-muted">No name</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="truncate" title={user.email}>
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap text-small text-ink-muted tabular-nums">
                          {formatDate(user.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          {tab === 'pending' ? (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                loading={actionLoading === user.id}
                                onClick={() => handleApprove(user)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setSingleConfirm({ type: 'reject', user })
                                }
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                loading={actionLoading === user.id}
                                onClick={() => handleApprove(user)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() =>
                                  setSingleConfirm({ type: 'delete', user })
                                }
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </tbody>
          </DataTable>
        )}
      </div>

      {selection.selectedIds.size > 0 && (
        <BulkBar
          selectedCount={selection.selectedIds.size}
          busy={bulkLoading}
          onClear={selection.clear}
          actions={
            tab === 'pending'
              ? [
                  {
                    key: 'approve',
                    label: 'Approve selected',
                    icon: 'check',
                    onClick: handleBulkApprove,
                  },
                  {
                    key: 'reject',
                    label: 'Reject selected',
                    icon: 'block',
                    onClick: () => setBulkAction('bulk-reject'),
                  },
                ]
              : [
                  {
                    key: 'approve',
                    label: 'Approve selected',
                    icon: 'check',
                    onClick: handleBulkApprove,
                  },
                  {
                    key: 'delete',
                    label: 'Delete selected',
                    icon: 'delete',
                    onClick: () => setBulkAction('bulk-delete'),
                  },
                ]
          }
        />
      )}

      <ConfirmDialog
        isOpen={singleConfirm !== null}
        title={
          singleConfirm?.type === 'reject'
            ? 'Reject request?'
            : 'Delete user?'
        }
        confirmLabel={
          singleConfirm?.type === 'reject' ? 'Reject' : 'Delete'
        }
        isConfirming={singleLoading}
        onConfirm={handleSingleConfirm}
        onCancel={() => setSingleConfirm(null)}
        message={
          singleConfirm?.type === 'reject' ? (
            <p>
              Reject {singleDisplayName}'s access request? They won't be able to
              sign in.
            </p>
          ) : (
            <p>
              Delete {singleDisplayName}? They'll lose access straight away.
              Documents they uploaded stay in the register.
            </p>
          )
        }
      />

      <ConfirmDialog
        isOpen={bulkAction !== null}
        title={
          bulkAction === 'bulk-reject'
            ? `Reject ${formatCountLabel(
                selection.selectedIds.size,
                'request',
                'requests',
              )}?`
            : `Delete ${formatCountLabel(
                selection.selectedIds.size,
                'user',
                'users',
              )}?`
        }
        confirmLabel={
          bulkAction === 'bulk-reject' ? 'Reject' : 'Delete'
        }
        isConfirming={bulkLoading}
        onConfirm={handleBulkConfirm}
        onCancel={() => setBulkAction(null)}
        message={
          bulkAction === 'bulk-reject' ? (
            <p>These users won't be able to sign in.</p>
          ) : (
            <p>
              They'll lose access straight away. Documents they uploaded stay in
              the register.
            </p>
          )
        }
      />
    </AdminSection>
  );
}
