import { useEffect, useRef, useState } from 'react';
import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  type ProjectMember,
} from '../../api/projects';
import { searchUsers, type UserSummary } from '../../api/users';
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Chip,
  IconButton,
  InlineAlert,
  Input,
  Modal,
  Spinner,
} from '../ui';
import { roleBadge } from '../../utils/userBadges';
import { formatCount } from '../../utils/format';

export interface ManageMembersModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onMembersUpdated: (projectId: string, addedCount: number) => void;
}

export function ManageMembersModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  onMembersUpdated,
}: ManageMembersModalProps) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [stagedMap, setStagedMap] = useState<Map<string, UserSummary>>(
    () => new Map(),
  );
  const [memberIds, setMemberIds] = useState<Set<string>>(() => new Set());
  const [currentMembers, setCurrentMembers] = useState<ProjectMember[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setStagedMap(new Map());
    setSearch('');
    setError('');
    setIsLoading(true);

    Promise.all([getProjectMembers(projectId), searchUsers('')])
      .then(([members, initialUsers]) => {
        setCurrentMembers(members);
        setMemberIds(new Set(members.map((m) => m.user.id)));
        setUsers(initialUsers);
      })
      .catch(() => {
        setError('Failed to load data. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, projectId]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      searchUsers(search)
        .then(setUsers)
        .catch(() => {
          // Silently ignore search error
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, isOpen]);

  const toggleStage = (user: UserSummary) => {
    setStagedMap((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) {
        next.delete(user.id);
      } else {
        next.set(user.id, user);
      }
      return next;
    });
  };

  const unstage = (userId: string) => {
    setStagedMap((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  };

  const handleSubmit = async () => {
    const toAdd = Array.from(stagedMap.values());
    if (toAdd.length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await Promise.all(
        toAdd.map((u) => addProjectMember(projectId, u.id)),
      );
      onMembersUpdated(projectId, toAdd.length);
      onClose();
    } catch {
      setError('Failed to add some members. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingId(userId);
    setError('');

    try {
      await removeProjectMember(projectId, userId);
      setCurrentMembers((prev) => prev.filter((m) => m.user.id !== userId));
      setMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      onMembersUpdated(projectId, -1);
    } catch {
      setError('Failed to remove member. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Manage members"
      description={projectName}
      initialFocusRef={searchRef}
      closeDisabled={isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            disabled={stagedMap.size === 0}
            onClick={handleSubmit}
          >
            Save changes ({formatCount(stagedMap.size)})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <div>
          <h3 className="text-label uppercase text-ink-muted">
            Current members ({formatCount(currentMembers.length)})
          </h3>
          {currentMembers.length === 0 ? (
            <p className="mt-1 text-small text-ink-muted">No members yet.</p>
          ) : (
            <ul className="mt-1.5 max-h-48 divide-y divide-line overflow-y-auto custom-scrollbar rounded border border-line">
              {currentMembers.map((m) => {
                const displayName = m.user.fullName || m.user.email;
                const badge = roleBadge(m.user.role);

                return (
                  <li
                    key={m.user.id}
                    className="flex items-center gap-2 px-2 py-1.5"
                  >
                    <Avatar
                      size="sm"
                      fullName={m.user.fullName}
                      email={m.user.email}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-ink">
                        {displayName}
                      </p>
                      <p className="truncate text-small text-ink-muted">
                        {m.user.email}
                      </p>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    <IconButton
                      size="sm"
                      icon="person_remove"
                      label={`Remove ${displayName} from ${projectName}`}
                      disabled={removingId === m.user.id}
                      onClick={() => handleRemoveMember(m.user.id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-label uppercase text-ink-muted">Add members</h3>
          <Input
            ref={searchRef}
            size="sm"
            leadingIcon="search"
            placeholder="Search by name or email"
            aria-label="Search users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {stagedMap.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {Array.from(stagedMap.values()).map((user) => (
                <Chip
                  key={user.id}
                  label="Add"
                  value={user.fullName || user.email}
                  onRemove={() => unstage(user.id)}
                />
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-small text-ink-muted">
              <Spinner size="sm" />
              <span>Loading users…</span>
            </div>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-small text-ink-muted">
              No users found.
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto custom-scrollbar rounded border border-line divide-y divide-line">
              {users.map((user) => {
                const isMember = memberIds.has(user.id);
                const isStaged = stagedMap.has(user.id);
                const displayName = user.fullName || user.email;

                return (
                  <li key={user.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-subtle">
                      {isMember ? (
                        <>
                          <Checkbox checked disabled />
                          <Avatar
                            size="sm"
                            fullName={user.fullName}
                            email={user.email}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body text-ink">
                              {displayName}
                            </p>
                            <p className="truncate text-small text-ink-muted">
                              {user.email}
                            </p>
                          </div>
                          <span className="text-small text-ink-muted">
                            Already a member
                          </span>
                        </>
                      ) : (
                        <>
                          <Checkbox
                            checked={isStaged}
                            onChange={() => toggleStage(user)}
                          />
                          <Avatar
                            size="sm"
                            fullName={user.fullName}
                            email={user.email}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body text-ink">
                              {displayName}
                            </p>
                            <p className="truncate text-small text-ink-muted">
                              {user.email}
                            </p>
                          </div>
                        </>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
