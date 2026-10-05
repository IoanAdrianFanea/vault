import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createUser, type UserSummary } from '../../api/users';
import {
  Button,
  FormField,
  InlineAlert,
  Input,
  Modal,
  PasswordInput,
  Select,
} from '../ui';

export interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (user: UserSummary) => void;
}

interface FormState {
  fullName: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
}

const empty: FormState = { fullName: '', email: '', password: '', role: 'USER' };

export function CreateUserModal({
  isOpen,
  onClose,
  onCreated,
}: CreateUserModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  useEffect(() => {
    if (isOpen) {
      setForm(empty);
      setError('');
    }
  }, [isOpen]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = form.fullName.trim();
    const trimmedEmail = form.email.trim();
    if (!trimmedName) {
      setError('Full name is required.');
      return;
    }
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }
    if (!form.password) {
      setError('Password is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const user = await createUser({
        fullName: trimmedName,
        email: trimmedEmail,
        password: form.password,
        role: form.role,
      });
      onCreated(user);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create user.',
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
      title="Create user"
      description="They can sign in straight away and will be asked to set their own password."
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
            Create user
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <FormField label="Full name" htmlFor="create-user-fullname">
          <Input
            ref={firstInputRef}
            id="create-user-fullname"
            type="text"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Jane Doe"
            maxLength={100}
          />
        </FormField>

        <FormField label="Email" htmlFor="create-user-email">
          <Input
            id="create-user-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. jane@example.com"
          />
        </FormField>

        <FormField
          label="Temporary password"
          htmlFor="create-user-password"
        >
          <PasswordInput
            id="create-user-password"
            autoComplete="new-password"
            placeholder="Set a temporary password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>

        <FormField label="Role" htmlFor="create-user-role">
          <Select
            id="create-user-role"
            value={form.role}
            onChange={(e) =>
              set('role', e.target.value as 'USER' | 'ADMIN')
            }
            disabled={isSubmitting}
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </FormField>
      </form>
    </Modal>
  );
}

