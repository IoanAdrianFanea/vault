/*
Modal form for creating a new project from the admin projects page.
*/


import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createProject, type AdminProject } from '../../api/projects';
import { Button, FormField, Input, Modal } from '../ui';

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: AdminProject) => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const inputId = useId();

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Project name cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const project = await createProject(trimmed);
      onCreated(project);
      onClose();
    } catch {
      setError('Failed to create project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="New project"
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
            disabled={isSubmitting || !name.trim()}
          >
            Create project
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <FormField
          label="Project name"
          htmlFor={inputId}
          hint="You can add members after it's created."
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
            placeholder="e.g. Q4 Financial Review"
            invalid={Boolean(error)}
          />
        </FormField>
      </form>
    </Modal>
  );
}

