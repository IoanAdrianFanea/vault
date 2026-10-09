/*
Landing page for the link in the verification email. It sends the token from the
URL to the server once and shows whether the email was confirmed.
*/


import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authService } from '../api/auth';
import { ButtonLink, Spinner } from '../components/ui';
import { AuthLayout } from '../components/layout/AuthLayout';

/**
 * VerifyEmail page — loaded when a user clicks the link in their verification email.
 *
 * URL: /verify-email?token=<raw-token>
 *
 * useEffect fires once on mount and calls the backend to consume the token.
 * Three render states: loading → success → error.
 */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link. Please use the link from your email.');
      return;
    }

    // Call backend once on mount — no deps needed (token comes from URL, not React state)
    authService
      .verifyEmail(token)
      .then((res) => {
        setMessage(res.message);
        setStatus('success');
      })
      .catch((err: unknown) => {
        setMessage(
          err instanceof Error
            ? err.message
            : 'Email verification failed. The link may have already been used or has expired.',
        );
        setStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center">
        {status === 'loading' && (
          <>
            <Spinner label="Verifying your email address" />
            <p className="mt-3 text-body text-ink-body">
              Verifying your email address…
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <span
              className="material-symbols-outlined text-[40px] leading-none text-accent"
              aria-hidden="true"
            >
              check_circle
            </span>
            <h1 className="mt-2 text-section text-ink">Email verified</h1>
            <p className="mt-1 text-body text-ink-muted">
              Your email is confirmed. You can sign in once an admin has approved
              your account.
            </p>
            <ButtonLink to="/login" variant="primary" className="mt-5">
              Go to sign in
            </ButtonLink>
          </>
        )}

        {status === 'error' && (
          <>
            <span
              className="material-symbols-outlined text-[40px] leading-none text-status-red-text"
              aria-hidden="true"
            >
              error
            </span>
            <h1 className="mt-2 text-section text-ink">Verification failed</h1>
            <p className="mt-1 text-body text-ink-muted">{message}</p>
            <ButtonLink to="/login" variant="secondary" className="mt-5">
              Back to sign in
            </ButtonLink>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

