import { useEffect, useState } from 'react';
import { deleteUser, type UserSummary } from '../../api/users';
import { ConfirmDialog, InlineAlert } from '../ui';

export interface DeleteUserModalProps {
  isOpen: boolean;
  user: UserSummary | null;
  onClose: () => void;
  onDeleted: (userId: string) => void;
}

export function DeleteUserModal({
  isOpen,
  user,
  onClose,
  onDeleted,
}: DeleteUserModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
    }
  }, [isOpen]);

  if (!user) return null;

  const displayName = user.fullName?.trim() || user.email;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await deleteUser(user.id);
      onDeleted(user.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete user. Please try again.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Delete user?"
      confirmLabel="Delete"
      isConfirming={isDeleting}
      onConfirm={handleDelete}
      onCancel={onClose}
      message={
        <div>
          <p>
            Delete {displayName}? Their account{' '}
            <strong className="font-semibold text-ink">
              and every document they uploaded
            </strong>{' '}
            will be permanently deleted. This can't be undone.
          </p>
          {error && (
            <InlineAlert tone="error" className="mt-3">
              {error}
            </InlineAlert>
          )}
        </div>
      }
    />
  );
}
