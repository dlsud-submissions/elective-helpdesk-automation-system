import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  DeniedState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/StatusViews';
import { useAuth } from './AuthProvider';
import type { AppRole } from './types';

/**
 * UI-only guard: it hides screens from signed-out users. The API still
 * verifies the token and role on every request.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state, retry } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return (
      <main className="page-center">
        <LoadingState label="Checking your session…" />
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="page-center">
        <ErrorState message={state.message} onRetry={retry} />
      </main>
    );
  }
  if (state.status === 'signedOut') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: AppRole[];
  children: ReactNode;
}) {
  const { state } = useAuth();
  if (state.status !== 'signedIn' || !roles.includes(state.profile.role)) {
    return <DeniedState />;
  }
  return <>{children}</>;
}
