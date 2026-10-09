/*
Access request page where a new user signs up with a name, email and password.
It then explains that they must verify their email and wait for admin approval.
*/


import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../api/auth';
import {
  Button,
  ButtonLink,
  FormField,
  InlineAlert,
  Input,
  PasswordChecklist,
  PasswordInput,
} from '../components/ui';
import { AuthLayout } from '../components/layout/AuthLayout';
import { meetsPasswordRules } from '../utils/passwordRules';

export default function Register() {
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!meetsPasswordRules(password)) {
      setError('Password does not meet the requirements listed below.');
      return;
    }

    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const fullName = ((formData.get('fullname') as string) ?? '').trim();

    try {
      await authService.register(email, password, fullName);
      setIsPending(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isPending) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-status-teal-bg text-accent">
            <span
              className="material-symbols-outlined text-[24px]"
              aria-hidden="true"
            >
              pending_actions
            </span>
          </div>
          <h1 className="mt-3 text-section text-ink">Request submitted</h1>
          <p className="mt-1 text-body text-ink-muted">
            Check your inbox for a verification link. Once an admin approves your
            request you'll be able to sign in.
          </p>
          <ButtonLink to="/login" variant="secondary" className="mt-5">
            Back to sign in
          </ButtonLink>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Request access"
      description="An admin will review your request. You'll also need to verify your email."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-link hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <FormField label="Full name" htmlFor="register-fullname">
          <Input
            id="register-fullname"
            name="fullname"
            autoComplete="name"
            required
          />
        </FormField>

        <FormField label="Work email" htmlFor="register-email">
          <Input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </FormField>

        <FormField label="Password" htmlFor="register-password">
          <PasswordInput
            id="register-password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-describedby="register-password-rules"
          />
          <PasswordChecklist
            id="register-password-rules"
            password={password}
          />
        </FormField>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={isLoading}
          disabled={!meetsPasswordRules(password)}
        >
          Request access
        </Button>
      </form>
    </AuthLayout>
  );
}

