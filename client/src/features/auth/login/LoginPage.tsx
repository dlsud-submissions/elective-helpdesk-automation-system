import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../../../shared/ui/StatusViews';
import { useAuth } from '../AuthProvider';
import { homePathFor, type SignedOutNotice } from '../types';

const noticeText: Record<SignedOutNotice, string | null> = {
  expired: 'Your session expired. Sign in again to continue.',
  noProfile: 'Your account is not set up for the helpdesk yet. Contact IT.',
  signedOut: null,
};

type FieldErrors = { email?: string; password?: string };

export function validateLogin(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Enter your work email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

export function LoginPage() {
  const { state, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const ids = { email: useId(), password: useId() };

  useEffect(() => {
    if (authError) alertRef.current?.focus();
  }, [authError]);

  if (state.status === 'loading') {
    return (
      <main className="page-center">
        <LoadingState label="Checking your session…" />
      </main>
    );
  }
  if (state.status === 'signedIn') {
    const target =
      from && from !== '/login' ? from : homePathFor(state.profile.role);
    return <Navigate to={target} replace />;
  }

  const notice =
    state.status === 'signedOut' && state.notice
      ? noticeText[state.notice]
      : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateLogin(email, password);
    setErrors(nextErrors);
    setAuthError(null);
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) setAuthError(result.message);
  }

  return (
    <main className="page-center">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="brand">[AI-HAS] IT Helpdesk</p>
        <h1 id="login-title">Sign in to get IT help</h1>

        {notice && !authError ? (
          <div className="alert alert--info" role="status">
            {notice}
          </div>
        ) : null}
        {authError ? (
          <div
            className="alert alert--error"
            role="alert"
            tabIndex={-1}
            ref={alertRef}
          >
            {authError}
          </div>
        ) : null}
        {state.status === 'error' ? (
          <div className="alert alert--error" role="alert">
            {state.message}
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor={ids.email}>Work email</label>
            <input
              id={ids.email}
              ref={emailRef}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${ids.email}-error` : undefined}
            />
            {errors.email ? (
              <p className="field__error" id={`${ids.email}-error`}>
                {errors.email}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor={ids.password}>Password</label>
            <div className="field__row">
              <input
                id={ids.password}
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? `${ids.password}-error` : undefined
                }
              />
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide password' : 'Show password'}
              </button>
            </div>
            {errors.password ? (
              <p className="field__error" id={`${ids.password}-error`}>
                {errors.password}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="button button--block"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="muted small">
          Prototype only. Use the fictional test accounts provided by the team.
        </p>
      </section>
    </main>
  );
}
