import { useState } from 'react';
import {
  archiveProject,
  type MissingArchiveDocument,
} from '../../api/archive';

interface ArchiveProjectModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onArchived: (id: string) => void;
}

export function ArchiveProjectModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  onArchived,
}: ArchiveProjectModalProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState('');
  const [missingDocuments, setMissingDocuments] = useState<
    MissingArchiveDocument[] | null
  >(null);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isArchiving) onClose();
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    setError('');
    try {
      const result = await archiveProject(projectId);
      onArchived(projectId);
      if (result.missingDocuments && result.missingDocuments.length > 0) {
        setMissingDocuments(result.missingDocuments);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive project');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-scrim/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-tertiary-container text-tertiary-dim flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">
                inventory_2
              </span>
            </div>
            <h2 className="text-title-md font-semibold text-on-surface">
              Archive Project
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isArchiving}
            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {missingDocuments ? (
            <div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3 mb-2">
                  <span className="material-symbols-outlined text-amber-500 text-[20px] mt-0.5 shrink-0">
                    warning
                  </span>
                  <p className="text-label-md font-semibold text-on-surface">
                    Archived with missing files
                  </p>
                </div>
                <p className="text-body-sm text-on-surface-variant mb-3">
                  Archived, but these files were missing from storage and are not in the archive:
                </p>
                <ul className="text-body-sm text-on-surface list-disc list-inside space-y-1 max-h-32 overflow-y-auto">
                  {missingDocuments.map((doc) => (
                    <li key={doc.id} className="truncate">
                      {doc.originalFilename}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-label-md font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-tertiary-container/30 border border-tertiary-dim/20 rounded-lg p-4 mb-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-tertiary-dim text-[20px] mt-0.5 shrink-0">
                  info
                </span>
                <div>
                  <p className="text-label-md font-semibold text-on-surface mb-1">
                    Are you sure?
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    <span className="font-medium text-on-surface">
                      "{projectName}"
                    </span>{' '}
                    will be archived and hidden from active views. Members will
                    lose access until the project is restored.
                  </p>
                </div>
              </div>

              {isArchiving && (
                <p className="mb-4 text-label-sm text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] animate-spin text-primary">
                    progress_activity
                  </span>
                  Large projects can take a few minutes.
                </p>
              )}

              {error && (
                <p className="mb-4 text-label-sm text-error flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    error
                  </span>
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isArchiving}
                  className="px-4 py-2 rounded-lg text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={isArchiving}
                  className="px-4 py-2 rounded-lg text-label-md font-semibold bg-tertiary text-on-tertiary hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  {isArchiving ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">
                      inventory_2
                    </span>
                  )}
                  Archive Project
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
