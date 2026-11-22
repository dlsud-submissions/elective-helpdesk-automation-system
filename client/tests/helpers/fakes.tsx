import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppRoutes } from '../../src/App';
import { AuthProvider } from '../../src/features/auth';

/** Fictional accounts used across client tests. */
export const profiles = {
  dana: { id: 'u-dana', displayName: 'Dana Cruz', role: 'employee' },
  lee: { id: 'u-lee', displayName: 'Lee Santos', role: 'agent' },
  ari: { id: 'u-ari', displayName: 'Ari Reyes', role: 'admin' },
} as const;

type FakeSession = { access_token: string } | null;
type AuthListener = (event: string, session: FakeSession) => void;

/** Minimal stand-in for the Supabase browser auth client. */
export function createFakeSupabase(
  options: {
    session?: FakeSession;
    validPassword?: string;
  } = {}
) {
  let session: FakeSession = options.session ?? null;
  const listeners = new Set<AuthListener>();
  const validPassword = options.validPassword ?? 'Password123!';

  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    signInWithPassword: vi.fn(
      async ({ email, password }: { email: string; password: string }) => {
        if (password !== validPassword) {
          return {
            data: { session: null, user: null },
            error: { status: 400, message: 'Invalid login credentials' },
          };
        }
        session = { access_token: `token-for-${email}` };
        return { data: { session, user: { id: email } }, error: null };
      }
    ),
    signOut: vi.fn(async () => {
      session = null;
      listeners.forEach((listener) => listener('SIGNED_OUT', null));
      return { error: null };
    }),
    onAuthStateChange: vi.fn((listener: AuthListener) => {
      listeners.add(listener);
      return {
        data: {
          subscription: { unsubscribe: () => listeners.delete(listener) },
        },
      };
    }),
  };

  return {
    auth,
    get session() {
      return session;
    },
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;

export type ApiCall = {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
};

export type ApiReply =
  | { status: number; body?: unknown }
  | Promise<{ status: number; body?: unknown }>;

export type ApiHandler = (call: ApiCall) => ApiReply | undefined;

/**
 * Stubs fetch and routes requests through `handler`. Unhandled requests
 * fail the test loudly with a 599 so missing mocks are obvious.
 */
export function mockApi(handler: ApiHandler) {
  const calls: ApiCall[] = [];
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const call: ApiCall = {
      method: init.method ?? 'GET',
      path: `${url.pathname}${url.search}`,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);
    const reply = (await handler(call)) ?? {
      status: 599,
      body: { error: `Unmocked ${call.method} ${call.path}` },
    };
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body ?? null,
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export function meHandler(profile: (typeof profiles)[keyof typeof profiles]) {
  return (call: ApiCall) =>
    call.path === '/api/me' ? { status: 200, body: { profile } } : undefined;
}

export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>
  );
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
