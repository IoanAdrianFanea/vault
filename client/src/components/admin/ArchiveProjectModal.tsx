/*
Confirmation modal for archiving a project. It shows progress while the zip is
built, then lists any files that were missing from storage and so left out of
the archive.
*/


import { useEffect, useState } from 'react';
import { archiveProject, type MissingArchiveDocument } from '../../api/archive';
import { Button, InlineAlert, Modal, Spinner } from '../ui';

export interface ArchiveProjectModalProps {
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

  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsArchiving(false);
      setMissingDocuments(null);
    }
  }, [isOpen]);

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
      setError(
        err instanceof Error ? err.message : 'Failed to archive project',
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const isResultStep = missingDocuments !== null;

  const modalTitle = isArchiving
    ? 'Archiving project'
    : isResultStep
    ? 'Project archived'
    : 'Archive project?';

  const modalFooter = isArchiving ? undefined : isResultStep ? (
    <Button variant="primary" onClick={onClose}>
      Done
    </Button>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isArchiving}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleArchive}>
        Archive
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={modalTitle}
      closeDisabled={isArchiving}
      showCloseButton={!isArchiving}
      footer={modalFooter}
    >
      {isArchiving ? (
        <div>
          <div className="flex items-center gap-2 text-body text-ink">
            <Spinner />
            <span>Archiving "{projectName}"?</span>
          </div>
          <p className="mt-1 text-small text-ink-muted">
            Large projects can take a few minutes.
          </p>
        </div>
      ) : isResultStep ? (
        <div className="space-y-3">
          <InlineAlert tone="warning">
            Archived, but these files were missing from storage and aren't in
            the archive:
          </InlineAlert>
          <ul className="list-disc pl-5 text-small text-ink-body space-y-0.5">
            {missingDocuments.map((doc) => (
              <li key={doc.id}>{doc.originalFilename}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-body text-ink-body">
            Archive "{projectName}"? Its files are zipped and the project is
            hidden from users until restored.
          </p>
          {error && <InlineAlert tone="error">{error}</InlineAlert>}
        </div>
      )}
    </Modal>
  );
}
