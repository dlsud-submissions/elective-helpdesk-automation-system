import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, ApiError, configureApiAuth } from '../../shared/api/http';
import { getSupabase } from '../../shared/supabase/client';
import type { AuthState, Profile, SignInResult } from './types';

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type ProfileResult =
  | { kind: 'ok'; profile: Profile }
  | { kind: 'expired' }
  | { kind: 'noProfile' }
  | { kind: 'error'; message: string };

async function loadProfile(): Promise<ProfileResult> {
  try {
    const { profile } = await apiFetch<{ profile: Profile }>('/api/me', {
      skipUnauthorizedHandler: true,
    });
    return { kind: 'ok', profile };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.kind === 'unauthorized') return { kind: 'expired' };
      if (error.code === 'profile_not_found') return { kind: 'noProfile' };
      return { kind: 'error', message: error.message };
    }
    return { kind: 'error', message: 'Could not load your profile.' };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Guards against races between sign-in and the initial session restore.
  const generation = useRef(0);

  const clearSession = useCallback(
    async (notice: 'expired' | 'noProfile' | 'signedOut') => {
      generation.current += 1;
      try {
        await getSupabase().auth.signOut();
      } catch {
        // Local session state is cleared regardless.
      }
      setState({ status: 'signedOut', notice });
    },
    []
  );

  const applyProfileResult = useCallback(
    async (result: ProfileResult, token: number) => {
      if (token !== generation.current) return;
      if (result.kind === 'ok') {
        setState({ status: 'signedIn', profile: result.profile });
      } else if (result.kind === 'error') {
        setState({ status: 'error', message: result.message });
      } else {
        await clearSession(result.kind);
      }
    },
    [clearSession]
  );

  useEffect(() => {
    configureApiAuth({
      getAccessToken: async () => {
        try {
          const { data } = await getSupabase().auth.getSession();
          return data.session?.access_token ?? null;
        } catch {
          return null;
        }
      },
      onUnauthorized: () => {
        void clearSession('expired');
      },
    });
  }, [clearSession]);

  // Restore an existing session on load (and on retry).
  useEffect(() => {
    const token = ++generation.current;
    let cancelled = false;

    async function restore() {
      setState({ status: 'loading' });
      let supabase;
      try {
        supabase = getSupabase();
      } catch (error) {
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Sign-in is unavailable.',
        });
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (cancelled || token !== generation.current) return;
      if (error) {
        await clearSession('expired');
        return;
      }
      if (!data.session) {
        setState({ status: 'signedOut' });
        return;
      }
      await applyProfileResult(await loadProfile(), token);
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [attempt, applyProfileResult, clearSession]);

  // Reflect sign-outs from other tabs or failed token refreshes.
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const { data } = getSupabase().auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          setState((current) =>
            current.status === 'signedIn'
              ? { status: 'signedOut', notice: 'expired' }
              : current
          );
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Configuration errors are surfaced by the restore effect.
    }
    return unsubscribe;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const token = ++generation.current;
      let result;
      try {
        result = await getSupabase().auth.signInWithPassword({
          email,
          password,
        });
      } catch {
        return {
          ok: false,
          message: "We couldn't reach the sign-in service. Try again.",
        };
      }

      if (result.error || !result.data.session) {
        const status = result.error?.status;
        return {
          ok: false,
          message:
            status && status >= 500
              ? "We couldn't reach the sign-in service. Try again."
              : 'Email or password is incorrect.',
        };
      }

      const profile = await loadProfile();
      if (profile.kind === 'ok') {
        await applyProfileResult(profile, token);
        return { ok: true };
      }
      if (profile.kind === 'noProfile' || profile.kind === 'expired') {
        await clearSession(profile.kind);
        return {
          ok: false,
          message:
            profile.kind === 'noProfile'
              ? 'Your account is not set up for the helpdesk yet. Contact IT.'
              : 'Your session could not be verified. Try again.',
        };
      }
      await clearSession('signedOut');
      return { ok: false, message: profile.message };
    },
    [applyProfileResult, clearSession]
  );

  const signOut = useCallback(() => clearSession('signedOut'), [clearSession]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const value = useMemo(
    () => ({ state, signIn, signOut, retry }),
    [state, signIn, signOut, retry]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}

/** Profile of the signed-in user; only valid inside RequireAuth. */
export function useProfile(): Profile {
  const { state } = useAuth();
  if (state.status !== 'signedIn') {
    throw new Error('useProfile requires a signed-in user.');
  }
  return state.profile;
}
