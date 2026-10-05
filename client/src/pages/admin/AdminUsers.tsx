import { useEffect, useMemo, useState } from 'react';
import {
  findAllUsers,
  bulkDeleteUsers,
  type UserSummary,
} from '../../api/users';
import { ChangeRoleModal } from '../../components/admin/ChangeRoleModal';
import { DeleteUserModal } from '../../components/admin/DeleteUserModal';
import { CreateUserModal } from '../../components/admin/CreateUserModal';
import { EditUserModal } from '../../components/admin/EditUserModal';
import { AdminSection } from '../../components/admin/AdminSection';
import { useAdminLayout } from '../../components/admin/adminLayoutContext';
import { useRangeSelection } from '../../hooks/useRangeSelection';
import {
  Avatar,
  Badge,
  BulkBar,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Dropdown,
  EmptyState,
  IconButton,
  InlineAlert,
  Input,
  TableCell,
  TableHeaderCell,
  TableRow,
  type DropdownOption,
} from '../../components/ui';
import { formatCountLabel, formatDate } from '../../utils/format';
import { ACCOUNT_STATUS_BADGES, ROLE_BADGES } from '../../utils/userBadges';

type RoleFilter = 'ALL' | 'ADMIN' | 'USER';
type StatusFilter = 'ALL' | 'ACTIVE' | 'PENDING' | 'REJECTED';
type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

const ROLE_OPTIONS: DropdownOption<RoleFilter>[] = [
  { value: 'ALL', label: 'All roles' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'USER', label: 'User' },
];

const STATUS_OPTIONS: DropdownOption<StatusFilter>[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
];

const SORT_OPTIONS: DropdownOption<SortOption>[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
];

export default function AdminUsers() {
  const { refreshPendingCount } = useAdminLayout();

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageAlert, setPageAlert] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<RoleFilter>('ALL');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [roleTarget, setRoleTarget] = useState<UserSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserSummary | null>(null);
  const [editTarget, setEditTarget] = useState<UserSummary | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = () => {
    setLoading(true);
    findAllUsers()
      .then((data) => {
        setUsers(data);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const visibleUsers = useMemo(() => {
    return users
      .filter((u) => {
        if (filterRole !== 'ALL' && u.role !== filterRole) return false;
        if (filterStatus !== 'ALL' && u.accountStatus !== filterStatus)
          return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const name = (u.fullName ?? '').toLowerCase();
          const email = u.email.toLowerCase();
          if (!name.includes(q) && !email.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest')
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        if (sortBy === 'oldest')
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        if (sortBy === 'name-asc') {
          const nameA = a.fullName || a.email;
          const nameB = b.fullName || b.email;
          return nameA.localeCompare(nameB);
        }
        if (sortBy === 'name-desc') {
          const nameA = a.fullName || a.email;
          const nameB = b.fullName || b.email;
          return nameB.localeCompare(nameA);
        }
        return 0;
      });
  }, [users, search, filterRole, filterStatus, sortBy]);

  const selection = useRangeSelection(
    visibleUsers.map((u) => u.id),
    `${search}|${filterRole}|${filterStatus}|${sortBy}`,
  );

  const handleRoleUpdated = (updated: UserSummary) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const handleUserUpdated = (updated: UserSummary) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const handleCreated = (user: UserSummary) => {
    setUsers((prev) => [user, ...prev]);
  };

  const handleDeleted = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    selection.retain(
      Array.from(selection.selectedIds).filter((id) => id !== userId),
    );
    refreshPendingCount();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selection.selectedIds);
    setBulkLoading(true);

    try {
      const res = await bulkDeleteUsers(ids);
      setUsers((prev) => prev.filter((u) => !res.succeeded.includes(u.id)));
      const failedIds = ids.filter((id) => !res.succeeded.includes(id));
      selection.retain(failedIds);

      if (res.failed > 0) {
        setPageAlert(
          `${formatCountLabel(res.failed, 'user', 'user accounts')} couldn't be deleted.`,
        );
      }
      setBulkDeleteOpen(false);
      refreshPendingCount();
    } catch {
      setPageAlert('Bulk delete failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <AdminSection
      bulkBarSpace={selection.selectedIds.size > 0}
      toolbarStart={
        <>
          <Input
            size="sm"
            leadingIcon="search"
            placeholder="Search by name or email"
            aria-label="Search users"
            className="w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Dropdown
            label="Role"
            value={filterRole}
            options={ROLE_OPTIONS}
            onChange={setFilterRole}
          />
          <Dropdown
            label="Status"
            value={filterStatus}
            options={STATUS_OPTIONS}
            onChange={setFilterStatus}
          />
          <Dropdown
            label="Sort"
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={setSortBy}
          />
        </>
      }
      toolbarEnd={
        <Button
          variant="primary"
          size="sm"
          icon="person_add"
          onClick={() => setCreateOpen(true)}
        >
          Create user
        </Button>
      }
    >
      <CreateUserModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
      <ChangeRoleModal
        isOpen={roleTarget !== null}
        user={roleTarget}
        onClose={() => setRoleTarget(null)}
        onUpdated={handleRoleUpdated}
      />
      <DeleteUserModal
        isOpen={deleteTarget !== null}
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
      <EditUserModal
        isOpen={editTarget !== null}
        user={editTarget}
        onClose={() => setEditTarget(null)}
        onUpdated={handleUserUpdated}
      />

      {pageAlert && (
        <InlineAlert tone="warning" onDismiss={() => setPageAlert(null)}>
          {pageAlert}
        </InlineAlert>
      )}

      {error ? (
        <InlineAlert tone="error">
          <p className="font-medium">Couldn't load users.</p>
          <p>{error}</p>
        </InlineAlert>
      ) : loading && users.length === 0 ? null : visibleUsers.length === 0 && users.length > 0 ? (
        <EmptyState
          icon="filter_alt_off"
          title="No users match these filters"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch('');
                setFilterRole('ALL');
                setFilterStatus('ALL');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <DataTable label="Users" fixed busy={loading && users.length > 0}>
          <thead>
            <TableRow>
              <TableHeaderCell align="center" className="w-8">
                <Checkbox
                  aria-label="Select all users"
                  checked={selection.allSelected}
                  indeterminate={
                    selection.someSelected && !selection.allSelected
                  }
                  onChange={(e) => selection.setAll(e.target.checked)}
                />
              </TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell className="w-[90px]">Role</TableHeaderCell>
              <TableHeaderCell className="w-[100px]">Status</TableHeaderCell>
              <TableHeaderCell className="w-[110px]">Joined</TableHeaderCell>
              <TableHeaderCell align="end" className="w-[112px]">
                Actions
              </TableHeaderCell>
            </TableRow>
          </thead>
          <tbody>
            {visibleUsers.map((user) => {
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
                      <Badge tone={ROLE_BADGES[user.role].tone}>
                        {ROLE_BADGES[user.role].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={ACCOUNT_STATUS_BADGES[user.accountStatus].tone}
                      >
                        {ACCOUNT_STATUS_BADGES[user.accountStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-small text-ink-muted tabular-nums">
                        {formatDate(user.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell align="end" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-0.5">
                        <IconButton
                          size="sm"
                          icon="edit"
                          label={`Edit ${displayName}`}
                          onClick={() => setEditTarget(user)}
                        />
                        <IconButton
                          size="sm"
                          icon="admin_panel_settings"
                          label={`Change role for ${displayName}`}
                          onClick={() => setRoleTarget(user)}
                        />
                        <IconButton
                          size="sm"
                          icon="delete"
                          label={`Delete ${displayName}`}
                          onClick={() => setDeleteTarget(user)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </tbody>
        </DataTable>
      )}

      {selection.selectedIds.size > 0 && (
        <BulkBar
          selectedCount={selection.selectedIds.size}
          actions={[
            {
              key: 'delete',
              label: 'Delete',
              icon: 'delete',
              onClick: () => setBulkDeleteOpen(true),
            },
          ]}
          busy={bulkLoading}
          onClear={selection.clear}
        />
      )}

      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        title={`Delete ${formatCountLabel(selection.selectedIds.size, 'user', 'users')}?`}
        confirmLabel="Delete"
        isConfirming={bulkLoading}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
        message={
          <p>
            Their accounts{' '}
            <strong className="font-semibold text-ink">
              and every document they uploaded
            </strong>{' '}
            will be permanently deleted. This can't be undone.
          </p>
        }
      />
    </AdminSection>
  );
}
