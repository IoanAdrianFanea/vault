import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../api/auth';
import {
  Button,
  FormField,
  InlineAlert,
  Input,
  PasswordInput,
} from '../components/ui';
import { AuthLayout } from '../components/layout/AuthLayout';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { accessToken, mustChangePassword } = await authService.login(
        email,
        password,
      );
      sessionStorage.setItem('accessToken', accessToken);
      if (mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/documents');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      description="Use your work email to access your company's documents."
      footer={
        <>
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-link hover:underline"
          >
            Request access
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <FormField label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </FormField>

        <FormField label="Password" htmlFor="login-password">
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            required
          />
        </FormField>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={isLoading}
        >
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

