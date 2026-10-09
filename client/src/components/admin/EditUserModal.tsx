/*
Modal form where an admin edits a user's name or email, or sets a new password.
Only the fields that changed are sent.
*/


import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { adminEditUser, type UserSummary } from '../../api/users';
import {
  Button,
  FormField,
  InlineAlert,
  Input,
  Modal,
  PasswordInput,
} from '../ui';

export interface EditUserModalProps {
  isOpen: boolean;
  user: UserSummary | null;
  onClose: () => void;
  onUpdated: (updated: UserSummary) => void;
}

interface FormState {
  fullName: string;
  email: string;
  password: string;
}

export function EditUserModal({
  isOpen,
  user,
  onClose,
  onUpdated,
}: EditUserModalProps) {
  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  useEffect(() => {
    if (isOpen && user) {
      setForm({
        fullName: user.fullName ?? '',
        email: user.email,
        password: '',
      });
      setError('');
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = form.fullName.trim();
    const trimmedEmail = form.email.trim();

    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const payload: { fullName?: string; email?: string; password?: string } = {};
      if (trimmedName !== (user.fullName ?? '')) payload.fullName = trimmedName;
      if (trimmedEmail !== user.email) payload.email = trimmedEmail;
      if (form.password) payload.password = form.password;

      const updated = await adminEditUser(user.id, payload);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update user.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Edit user"
      description={user.email}
      closeDisabled={isSubmitting}
      initialFocusRef={firstInputRef}
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
          >
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <FormField label="Full name" htmlFor="edit-user-fullname">
          <Input
            ref={firstInputRef}
            id="edit-user-fullname"
            type="text"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            disabled={isSubmitting}
            placeholder="Full name"
          />
        </FormField>

        <FormField label="Email" htmlFor="edit-user-email">
          <Input
            id="edit-user-email"
            type="email"
            value={form.email}
            required
            onChange={(e) => set('email', e.target.value)}
            disabled={isSubmitting}
            placeholder="user@company.com"
          />
        </FormField>

        <FormField
          label="New temporary password"
          htmlFor="edit-user-password"
          hint="Minimum 8 characters. They'll be asked to set a stronger password at next sign-in."
        >
          <PasswordInput
            id="edit-user-password"
            autoComplete="new-password"
            placeholder="Leave blank to keep the current password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            disabled={isSubmitting}
            minLength={form.password ? 8 : undefined}
          />
        </FormField>
      </form>
    </Modal>
  );
}

