import { useEffect, useId, useState, type FormEvent } from 'react';
import { setUserRole, type UserSummary } from '../../api/users';
import { Button, InlineAlert, Modal } from '../ui';

export interface ChangeRoleModalProps {
  isOpen: boolean;
  user: UserSummary | null;
  onClose: () => void;
  onUpdated: (updated: UserSummary) => void;
}

export function ChangeRoleModal({
  isOpen,
  user,
  onClose,
  onUpdated,
}: ChangeRoleModalProps) {
  const [selectedRole, setSelectedRole] = useState<'USER' | 'ADMIN'>(
    user?.role ?? 'USER',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const formId = useId();

  useEffect(() => {
    if (isOpen && user) {
      setSelectedRole(user.role);
      setError('');
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const hasChanged = selectedRole !== user.role;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasChanged) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const updated = await setUserRole(user.id, selectedRole);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = user.fullName?.trim() || user.email;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Change role"
      description={displayName}
      closeDisabled={isSubmitting}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            loading={isSubmitting}
            disabled={isSubmitting || !hasChanged}
          >
            Save
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <fieldset className="space-y-2">
          <legend className="sr-only">Role</legend>

          <label
            className={`flex cursor-pointer gap-3 rounded border p-3 transition-colors ${
              selectedRole === 'USER'
                ? 'border-accent bg-selected'
                : 'border-line hover:bg-subtle'
            }`}
          >
            <input
              type="radio"
              name="role"
              value="USER"
              checked={selectedRole === 'USER'}
              onChange={() => setSelectedRole('USER')}
              disabled={isSubmitting}
              className="mt-0.5 size-3.5 border-line-strong text-accent focus:ring-accent"
            />
            <span>
              <span className="block text-body font-medium text-ink">User</span>
              <span className="block text-small text-ink-muted">
                Can view, upload and delete documents in projects they're assigned
                to.
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer gap-3 rounded border p-3 transition-colors ${
              selectedRole === 'ADMIN'
                ? 'border-accent bg-selected'
                : 'border-line hover:bg-subtle'
            }`}
          >
            <input
              type="radio"
              name="role"
              value="ADMIN"
              checked={selectedRole === 'ADMIN'}
              onChange={() => setSelectedRole('ADMIN')}
              disabled={isSubmitting}
              className="mt-0.5 size-3.5 border-line-strong text-accent focus:ring-accent"
            />
            <span>
              <span className="block text-body font-medium text-ink">
                Admin
              </span>
              <span className="block text-small text-ink-muted">
                Full access to all projects, documents, users and settings.
              </span>
            </span>
          </label>
        </fieldset>
      </form>
    </Modal>
  );
}

