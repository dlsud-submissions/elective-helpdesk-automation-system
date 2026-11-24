import { useState, type FormEvent } from 'react';
import { apiFetch } from '../../shared/api/http';
import { getSupabase } from '../../shared/supabase/client';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useProfile } from './AuthProvider';

export function SettingsPage() {
  useDocumentTitle('Settings');
  const profile = useProfile();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/me/profile', {
        method: 'PATCH',
        body: { displayName },
      });

      if (email !== profile.email) {
        const { error: emailError } = await getSupabase().auth.updateUser({
          email,
        });
        if (emailError) throw emailError;
      }
      if (password) {
        if (password.length < 8)
          throw new Error('Password must be at least 8 characters.');
        const { error: passwordError } = await getSupabase().auth.updateUser({
          password,
        });
        if (passwordError) throw passwordError;
      }

      setPassword('');
      setMessage('Settings saved. Email changes may require confirmation.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Settings could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="narrow">
      <section className="panel" aria-labelledby="settings-title">
        <h1 id="settings-title">Settings</h1>
        <form className="form-stack" onSubmit={saveProfile}>
          <label className="field">
            <span>Name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Leave blank to keep current password"
            />
          </label>
          {error ? (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="alert alert--success" role="status">
              {message}
            </p>
          ) : null}
          <button
            className="button"
            type="submit"
            disabled={saving || !displayName.trim() || !email.trim()}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </section>
    </div>
  );
}
