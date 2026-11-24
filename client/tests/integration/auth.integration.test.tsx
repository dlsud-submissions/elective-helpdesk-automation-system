import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeSupabase,
  meHandler,
  mockApi,
  profiles,
  renderApp,
  type FakeSupabase,
} from '../helpers/fakes';

let fake: FakeSupabase;
vi.mock('../../src/shared/supabase/client', () => ({
  getSupabase: () => fake,
}));

async function signIn(email: string, password: string) {
  fireEvent.change(await screen.findByLabelText('Work email'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

const emptyChat = (call: { path: string }) =>
  call.path === '/api/conversations'
    ? { status: 200, body: { conversations: [] } }
    : undefined;

describe('sign-in and role-aware routing (S3-01)', () => {
  beforeEach(() => {
    fake = createFakeSupabase();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects signed-out users to sign-in and validates fields', async () => {
    mockApi(() => undefined);
    renderApp('/chat');

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your work email.')).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveFocus();
    expect(fake.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows a generic error for bad credentials', async () => {
    mockApi(() => undefined);
    renderApp('/login');
    await signIn('dana.cruz@example.test', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect.'
    );
  });

  it('signs an employee in, sends the bearer token, and hides staff nav', async () => {
    const { calls } = mockApi(
      (call) => meHandler(profiles.dana)(call) ?? emptyChat(call)
    );
    renderApp('/login');
    await signIn('dana.cruz@example.test', 'Password123!');

    expect(
      await screen.findByRole('heading', { name: 'Ask IT' })
    ).toBeInTheDocument();
    expect(screen.getByText('Dana Cruz')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Queue' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();

    const me = calls.find((call) => call.path === '/api/me');
    expect(me?.headers.Authorization).toBe(
      'Bearer token-for-dana.cruz@example.test'
    );
  });

  it('shows the not-set-up message when the user has no profile', async () => {
    mockApi((call) =>
      call.path === '/api/me'
        ? {
            status: 403,
            body: { error: 'No profile', code: 'profile_not_found' },
          }
        : undefined
    );
    renderApp('/login');
    await signIn('new.hire@example.test', 'Password123!');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your account is not set up for the helpdesk yet. Contact IT.'
    );
    expect(fake.auth.signOut).toHaveBeenCalled();
  });

  it('restores a saved session on reload and routes agents to the dashboard', async () => {
    fake = createFakeSupabase({ session: { access_token: 'saved' } });
    mockApi(
      (call) =>
        meHandler(profiles.lee)(call) ??
        (call.path === '/api/tickets'
          ? { status: 200, body: { tickets: [] } }
          : undefined)
    );
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Agent dashboard' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Queue' })).toBeNull();
  });

  it('returns an expired session to sign-in with a clear notice', async () => {
    fake = createFakeSupabase({ session: { access_token: 'expired' } });
    mockApi((call) =>
      call.path === '/api/me'
        ? { status: 401, body: { error: 'expired', code: 'unauthorized' } }
        : undefined
    );
    renderApp('/chat');

    expect(
      await screen.findByText(
        'Your session expired. Sign in again to continue.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sign in to get IT help' })
    ).toBeInTheDocument();
  });

  it('allows employees to open their dashboard with scoped metrics', async () => {
    fake = createFakeSupabase({ session: { access_token: 'saved' } });
    const { calls } = mockApi(
      (call) =>
        meHandler(profiles.dana)(call) ??
        (call.path.startsWith('/api/analytics/summary')
          ? {
              status: 200,
              body: {
                summary: {
                  range: {
                    from: '2026-10-22T00:00:00.000Z',
                    to: '2026-11-20T23:59:59.999Z',
                  },
                  totalTickets: 0,
                  byStatus: {
                    new: 0,
                    open: 0,
                    in_progress: 0,
                    pending: 0,
                    resolved: 0,
                    closed: 0,
                  },
                  openByPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
                  createdInRange: 0,
                  resolvedInRange: 0,
                },
              },
            }
          : call.path === '/api/tickets'
            ? { status: 200, body: { tickets: [] } }
            : undefined)
    );
    renderApp('/dashboard');

    expect(
      await screen.findByRole('heading', { name: 'Employee dashboard' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Open unassigned')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(calls.some((call) => call.path.startsWith('/api/analytics'))).toBe(
        true
      )
    );
  });

  it('denies employees direct access to the admin queue', async () => {
    fake = createFakeSupabase({ session: { access_token: 'saved' } });
    mockApi(meHandler(profiles.dana));
    renderApp('/queue');

    expect(
      await screen.findByRole('heading', { name: 'Access denied' })
    ).toBeInTheDocument();
  });

  it('denies agents direct access to the admin queue', async () => {
    fake = createFakeSupabase({ session: { access_token: 'saved' } });
    mockApi(meHandler(profiles.lee));
    renderApp('/queue');

    expect(
      await screen.findByRole('heading', { name: 'Access denied' })
    ).toBeInTheDocument();
  });

  it('hides and denies admin access to Chat and My tickets', async () => {
    fake = createFakeSupabase({ session: { access_token: 'saved' } });
    mockApi(meHandler(profiles.ari));
    const chat = renderApp('/chat');

    expect(
      await screen.findByRole('heading', { name: 'Access denied' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Chat' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'My tickets' })
    ).not.toBeInTheDocument();

    chat.unmount();
    renderApp('/tickets');
    expect(
      await screen.findByRole('heading', { name: 'Access denied' })
    ).toBeInTheDocument();
  });

  it('signs out from the app shell', async () => {
    fake = createFakeSupabase({ session: { access_token: 'saved' } });
    mockApi((call) => meHandler(profiles.dana)(call) ?? emptyChat(call));
    renderApp('/chat');

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Sign in to get IT help' })
      ).toBeInTheDocument()
    );
    expect(fake.session).toBeNull();
  });
});
