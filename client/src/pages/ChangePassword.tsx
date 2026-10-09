/*
Page shown after a first sign-in with a temporary password, forcing the user to
set a new one that meets the password rules before continuing.
*/


import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../api/auth';
import {
  Button,
  FormField,
  InlineAlert,
  PasswordChecklist,
  PasswordInput,
} from '../components/ui';
import { AuthLayout } from '../components/layout/AuthLayout';
import { meetsPasswordRules } from '../utils/passwordRules';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!meetsPasswordRules(newPassword)) {
      setError('Please meet all password requirements below.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      navigate('/documents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Set a new password"
      description="Your account requires a new password before you can continue."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <FormField
          label="Current (temporary) password"
          htmlFor="change-password-current"
        >
          <PasswordInput
            id="change-password-current"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </FormField>

        <FormField label="New password" htmlFor="change-password-new">
          <PasswordInput
            id="change-password-new"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            aria-describedby="change-password-rules"
          />
          <PasswordChecklist
            id="change-password-rules"
            password={newPassword}
          />
        </FormField>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={isLoading}
          disabled={!meetsPasswordRules(newPassword)}
        >
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}

