import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabase } from '../../shared/supabase/client';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

export function SignupPage() {
  useDocumentTitle('Create account');
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!displayName.trim()) {
      setError('Enter your name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signupError } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (signupError) throw signupError;
      if (!data.session) {
        setError('Check your email to confirm your account, then sign in.');
        return;
      }
      navigate('/chat', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Account could not be created.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-center auth-fullscreen">
      <section className="auth-card" aria-labelledby="signup-title">
        <p className="brand brand--auth">
          <img src="/assets/logo.png" alt="" className="brand__logo" />
          Harbor Tickets
        </p>
        <h1 id="signup-title">Create an account</h1>
        <form className="form-stack" onSubmit={submit} noValidate>
          <label className="field">
            <span>Name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
              autoComplete="name"
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </label>
          {error ? (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="button button--block"
            type="submit"
            disabled={
              submitting ||
              !displayName.trim() ||
              !email.trim() ||
              password.length < 8
            }
          >
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="muted small">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
