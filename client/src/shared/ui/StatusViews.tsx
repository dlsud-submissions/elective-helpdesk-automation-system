import type { ReactNode } from 'react';

export function LoadingState({ label }: { label: string }) {
  return (
    <p className="state state--loading" role="status">
      <span className="spinner" aria-hidden="true" /> {label}
    </p>
  );
}

export function ErrorState({
  message,
  onRetry,
  children,
}: {
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="alert alert--error" role="alert">
      <p>{message}</p>
      <div className="alert__actions">
        {onRetry ? (
          <button type="button" className="button" onClick={onRetry}>
            Retry
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="state state--empty">{children}</div>;
}

export function DeniedState({
  message = "You don't have permission to view this page.",
}: {
  message?: string;
}) {
  return (
    <section className="panel" aria-labelledby="denied-title">
      <h1 id="denied-title">Access denied</h1>
      <p role="alert">{message}</p>
    </section>
  );
}
