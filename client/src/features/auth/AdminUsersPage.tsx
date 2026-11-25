import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../../shared/api/http';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'employee' | 'agent' | 'admin';
  accountStatus: 'active' | 'suspended' | 'banned';
  suspendedUntil: string | null;
  banReason: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
};

export function AdminUsersPage() {
  useDocumentTitle('Manage users');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'agent' | 'admin'>('agent');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [durationHours, setDurationHours] = useState('24');
  const [reason, setReason] = useState('');
  const [state, setState] = useState<{
    kind: 'idle' | 'saving' | 'saved' | 'error';
    message?: string;
  }>({ kind: 'idle' });

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const result = await apiFetch<{ users: ManagedUser[] }>(
        '/api/admin/users'
      );
      setUsers(result.users);
    } catch (caught) {
      setState({
        kind: 'error',
        message:
          caught instanceof Error
            ? caught.message
            : 'Users could not be loaded.',
      });
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setState({ kind: 'saving' });
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: { displayName, email, password, role },
      });
      setDisplayName('');
      setEmail('');
      setPassword('');
      setRole('agent');
      await loadUsers();
      setState({ kind: 'saved', message: `${role} account created.` });
    } catch (caught) {
      setState({
        kind: 'error',
        message:
          caught instanceof Error
            ? caught.message
            : 'User could not be created.',
      });
    }
  }

  async function setStatus(
    userId: string,
    action: 'suspend' | 'ban' | 'unsuspend'
  ) {
    setState({ kind: 'saving' });
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        body: {
          action,
          durationHours:
            action === 'suspend' ? Number(durationHours) : undefined,
          reason,
        },
      });
      await loadUsers();
      setState({
        kind: 'saved',
        message: `Account ${action === 'unsuspend' ? 'restored' : action === 'ban' ? 'banned' : 'suspended'}.`,
      });
    } catch (caught) {
      setState({
        kind: 'error',
        message:
          caught instanceof Error
            ? caught.message
            : 'Account status could not be changed.',
      });
    }
  }

  return (
    <div className="narrow admin-users-page">
      <section className="panel" aria-labelledby="admin-users-title">
        <h1 id="admin-users-title">Create helpdesk user</h1>
        <form className="form-stack" onSubmit={createUser}>
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
            <span>Temporary password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as 'agent' | 'admin')
              }
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {state.kind === 'saved' ? (
            <p className="alert alert--success" role="status">
              {state.message}
            </p>
          ) : null}
          {state.kind === 'error' ? (
            <p className="alert alert--error" role="alert">
              {state.message}
            </p>
          ) : null}
          <button
            className="button"
            type="submit"
            disabled={
              state.kind === 'saving' ||
              !displayName.trim() ||
              !email.trim() ||
              password.length < 8
            }
          >
            {state.kind === 'saving' ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </section>

      <section className="panel" aria-labelledby="users-directory-title">
        <h2 id="users-directory-title">User directory</h2>
        <div className="form-stack user-status-controls">
          <label className="field">
            <span>Suspension duration (hours)</span>
            <input
              type="number"
              min="1"
              max="876000"
              value={durationHours}
              onChange={(event) => setDurationHours(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Reason</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Optional reason for suspension or ban"
            />
          </label>
        </div>
        {loadingUsers ? <p className="muted">Loading users…</p> : null}
        {!loadingUsers && users.length === 0 ? (
          <p className="muted">No users found.</p>
        ) : null}
        {users.length > 0 ? (
          <div
            className="user-table-wrap"
            role="region"
            aria-label="User directory results"
            tabIndex={0}
          >
            <table className="metric-table user-table">
              <colgroup>
                <col className="user-table__name" />
                <col className="user-table__email" />
                <col className="user-table__role" />
                <col className="user-table__status" />
                <col className="user-table__created" />
                <col className="user-table__last-sign-in" />
                <col className="user-table__actions-column" />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last sign-in</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName}</td>
                    <td>{user.email || '—'}</td>
                    <td>{user.role}</td>
                    <td>
                      <div className="user-account-status">
                        <span className={`badge badge--${user.accountStatus}`}>
                          {user.accountStatus}
                        </span>
                        {user.accountStatus === 'suspended' &&
                        user.suspendedUntil ? (
                          <span className="user-account-status__detail">
                            Until{' '}
                            {new Date(user.suspendedUntil).toLocaleString()}
                          </span>
                        ) : null}
                        {user.banReason ? (
                          <span className="user-account-status__detail">
                            {user.banReason}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleString()
                        : '—'}
                    </td>
                    <td>
                      {user.lastSignInAt
                        ? new Date(user.lastSignInAt).toLocaleString()
                        : 'Never'}
                    </td>
                    <td>
                      {user.accountStatus === 'active' ? (
                        <div className="user-table__actions">
                          <button
                            type="button"
                            className="button button--secondary"
                            onClick={() => void setStatus(user.id, 'suspend')}
                          >
                            Suspend
                          </button>
                          <button
                            type="button"
                            className="button button--danger"
                            onClick={() => void setStatus(user.id, 'ban')}
                          >
                            Ban
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="button button--secondary"
                          onClick={() => void setStatus(user.id, 'unsuspend')}
                        >
                          Unsuspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
