import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toApiError, type ApiError } from '../../../shared/api/http';
import {
  DeniedState,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../../shared/ui/StatusViews';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';
import { useProfile } from '../../auth';
import { listTickets, TicketDetail, type Ticket } from '../../tickets';
import {
  getAnalyticsSummary,
  type AnalyticsSummary,
  type TicketStatusKey,
} from '../api/analytics.api';

const statusLabels: Record<TicketStatusKey, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; summary: AnalyticsSummary }
  | { status: 'error'; error: ApiError };

export function DashboardPage() {
  const profile = useProfile();
  const { ticketId } = useParams();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  useDocumentTitle(ticketId ? 'Assigned ticket' : 'Dashboard');

  const fetchSummary = useCallback(async () => {
    setLoad({ status: 'loading' });
    try {
      setLoad({ status: 'ready', summary: await getAnalyticsSummary() });
    } catch (error) {
      setLoad({ status: 'error', error: toApiError(error) });
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  if (ticketId && profile.role === 'agent') {
    return (
      <section className="narrow">
        <Link to="/dashboard" className="back-link back-link--always">
          <span aria-hidden="true">← </span>Back to dashboard
        </Link>
        <TicketDetail ticketId={ticketId} onSaved={() => void fetchSummary()} />
      </section>
    );
  }

  if (load.status === 'error' && load.error.kind === 'forbidden') {
    return <DeniedState />;
  }

  return (
    <section aria-labelledby="dashboard-title" className="dashboard">
      <h1 id="dashboard-title">
        {profile.role === 'admin'
          ? 'Helpdesk dashboard'
          : profile.role === 'agent'
            ? 'Agent dashboard'
            : 'Employee dashboard'}
      </h1>

      {load.status === 'loading' ? (
        <LoadingState label="Loading metrics…" />
      ) : null}
      {load.status === 'error' ? (
        <ErrorState
          message={load.error.message}
          onRetry={() => void fetchSummary()}
        />
      ) : null}

      {load.status === 'ready' && load.summary.totalTickets === 0 ? (
        <EmptyState>
          <p>
            {profile.role === 'agent'
              ? 'No tickets are assigned to you yet.'
              : profile.role === 'employee'
                ? "You haven't created any tickets yet."
                : 'No tickets yet. Metrics appear once tickets are created.'}
          </p>
        </EmptyState>
      ) : null}

      {load.status === 'ready' ? (
        <SummaryView summary={load.summary} role={profile.role} />
      ) : null}
      {profile.role === 'admin' ? (
        <p>
          <Link to="/queue" className="button button--secondary">
            Manage ticket queue
          </Link>
        </p>
      ) : (
        <DashboardWorklist role={profile.role} />
      )}
    </section>
  );
}

function SummaryView({
  summary,
  role,
}: {
  summary: AnalyticsSummary;
  role: 'employee' | 'agent' | 'admin';
}) {
  const activeTickets =
    summary.byStatus.new +
    summary.byStatus.open +
    summary.byStatus.in_progress +
    summary.byStatus.pending;
  const resolvedTickets = summary.byStatus.resolved + summary.byStatus.closed;
  const tiles: Array<{ label: string; value: number }> =
    role === 'admin'
      ? [
          { label: 'Assigned tickets', value: summary.assignedTickets ?? 0 },
          { label: 'Open tickets', value: activeTickets },
          { label: 'Resolved tickets', value: resolvedTickets },
        ]
      : role === 'agent'
        ? [
            { label: 'All tickets', value: summary.totalTickets },
            { label: 'Open tickets', value: activeTickets },
            { label: 'Resolved tickets', value: resolvedTickets },
          ]
        : [
            { label: 'Created tickets', value: summary.totalTickets },
            { label: 'Resolved tickets', value: resolvedTickets },
          ];

  return (
    <>
      <ul className="tiles" aria-label="Key metrics">
        {tiles.map((tile) => (
          <li key={tile.label} className="tile">
            <span className="tile__value">{tile.value}</span>
            <span className="tile__label">{tile.label}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function DashboardWorklist({ role }: { role: 'employee' | 'agent' }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setTickets(await listTickets());
    } catch (loadError) {
      setError(toApiError(loadError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const agent = role === 'agent';
  const title = agent ? 'Assigned tickets' : 'My tickets';
  const destination = (ticket: Ticket) =>
    agent ? `/dashboard/${ticket.id}` : `/tickets/${ticket.id}`;

  return (
    <section aria-labelledby="dashboard-worklist-title">
      <header className="row row--between">
        <h2 id="dashboard-worklist-title">{title}</h2>
        {agent ? null : <Link to="/tickets">View all</Link>}
      </header>
      {tickets === null && !error ? (
        <LoadingState
          label={agent ? 'Loading assigned tickets…' : 'Loading your tickets…'}
        />
      ) : null}
      {error ? (
        <ErrorState message={error.message} onRetry={() => void refresh()} />
      ) : null}
      {tickets?.length === 0 ? (
        <EmptyState>
          <p>
            {agent
              ? 'No tickets are assigned to you.'
              : "You haven't created any tickets yet."}
          </p>
          {agent ? null : (
            <Link to="/chat" className="button button--secondary">
              Ask IT in chat
            </Link>
          )}
        </EmptyState>
      ) : null}
      {tickets && tickets.length > 0 ? (
        <ul className="ticket-list" aria-label={title}>
          {(agent ? tickets : tickets.slice(0, 5)).map((ticket) => (
            <li key={ticket.id}>
              <Link to={destination(ticket)} className="ticket-row">
                <span className="ticket-row__head">
                  <strong>{ticket.reference}</strong>
                  <span className={`badge badge--${ticket.status}`}>
                    {statusLabels[ticket.status]}
                  </span>
                </span>
                <span className="ticket-row__title">{ticket.title}</span>
                <span className="muted small">
                  {agent
                    ? `Requested by ${ticket.requesterName}`
                    : ticket.assigneeName
                      ? `Handled by ${ticket.assigneeName}`
                      : 'Not yet assigned'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
