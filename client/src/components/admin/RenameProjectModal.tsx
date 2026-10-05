import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { renameProject } from '../../api/projects';
import { Button, FormField, Input, Modal } from '../ui';

export interface RenameProjectModalProps {
  isOpen: boolean;
  projectId: string;
  currentName: string;
  onClose: () => void;
  onRenamed: (id: string, newName: string) => void;
}

export function RenameProjectModal({
  isOpen,
  projectId,
  currentName,
  onClose,
  onRenamed,
}: RenameProjectModalProps) {
  const [name, setName] = useState(currentName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const inputId = useId();

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError('');
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Project name cannot be empty.');
      return;
    }
    if (trimmed === currentName) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await renameProject(projectId, trimmed);
      onRenamed(projectId, trimmed);
      onClose();
    } catch {
      setError('Failed to rename project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSaveDisabled =
    isSubmitting || name.trim() === '' || name.trim() === currentName;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="Rename project"
      closeDisabled={isSubmitting}
      initialFocusRef={inputRef}
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
            disabled={isSaveDisabled}
          >
            Save
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <FormField
          label="Project name"
          htmlFor={inputId}
          error={error}
        >
          <Input
            ref={inputRef}
            id={inputId}
            type="text"
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            invalid={Boolean(error)}
          />
        </FormField>
      </form>
    </Modal>
  );
}

