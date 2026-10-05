import { useEffect, useState } from 'react';
import { deleteProject } from '../../api/projects';
import { ConfirmDialog, InlineAlert } from '../ui';

export interface DeleteProjectModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function DeleteProjectModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  onDeleted,
}: DeleteProjectModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
    }
  }, [isOpen]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await deleteProject(projectId);
      onDeleted(projectId);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't delete the project. Try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Delete project?"
      confirmLabel="Delete"
      isConfirming={isDeleting}
      onConfirm={handleDelete}
      onCancel={onClose}
      message={
        <div>
          <p>
            Delete "{projectName}"? The project and its documents will move to
            the recycle bin. An admin can restore them for 30 days.
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
