import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../api/auth';
import {
  ensureSession,
  SERVER_UNAVAILABLE_MESSAGE,
  setAccessToken,
} from '../api/http';
import {
  Button,
  FormField,
  InlineAlert,
  Input,
  PasswordInput,
  Spinner,
} from '../components/ui';
import { AuthLayout } from '../components/layout/AuthLayout';

function safeNextPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
    return null;
  }
  return value;
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const safeNext = safeNextPath(searchParams.get('next'));
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    ensureSession().then((result) => {
      if (!active) return;
      if (result === 'signed-in') {
        navigate(safeNext ?? '/documents', { replace: true });
        return;
      }
      setIsUnavailable(result === 'unavailable');
      setIsCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, [checkAttempt, navigate, safeNext]);

  const handleRetryCheck = () => {
    setIsUnavailable(false);
    setIsCheckingSession(true);
    setCheckAttempt((attempt) => attempt + 1);
  };

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
      setAccessToken(accessToken);
      if (mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate(safeNext ?? '/documents', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <AuthLayout>
        <div className="flex justify-center py-6">
          <Spinner label="Checking your session" />
        </div>
      </AuthLayout>
    );
  }

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
        {isUnavailable && (
          <InlineAlert tone="warning">
            <p>{SERVER_UNAVAILABLE_MESSAGE}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={handleRetryCheck}
            >
              Try again
            </Button>
          </InlineAlert>
        )}
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

