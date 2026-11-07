import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toApiError, type ApiError } from '../../../shared/api/http';
import {
  DeniedState,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../../shared/ui/StatusViews';
import { listTickets } from '../api/tickets.api';
import {
  defaultFilters,
  filterQueue,
  formatRelative,
  priorityLabels,
  statusLabels,
  type QueueFilters,
} from '../model/queue';
import type { Ticket, TicketStatus } from '../types';
import { TicketDetail } from './TicketDetail';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; tickets: Ticket[] }
  | { status: 'error'; error: ApiError };

export function TicketQueuePage() {
  const { ticketId } = useParams();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [filters, setFilters] = useState<QueueFilters>(defaultFilters);

  const refresh = useCallback(async () => {
    try {
      setLoad({ status: 'ready', tickets: await listTickets() });
    } catch (error) {
      setLoad({ status: 'error', error: toApiError(error) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(
    () => (load.status === 'ready' ? filterQueue(load.tickets, filters) : []),
    [load, filters]
  );

  const onTicketSaved = useCallback((updated: Ticket) => {
    setLoad((current) =>
      current.status === 'ready'
        ? {
            status: 'ready',
            tickets: current.tickets.map((ticket) =>
              ticket.id === updated.id ? updated : ticket
            ),
          }
        : current
    );
  }, []);

  if (load.status === 'error' && load.error.kind === 'forbidden') {
    return <DeniedState />;
  }

  return (
    <div className={`split ${ticketId ? 'split--detail' : ''}`}>
      <section className="split__list" aria-labelledby="queue-title">
        <h1 id="queue-title">Ticket queue</h1>
        <div className="filters" role="group" aria-label="Queue filters">
          <label className="field field--inline">
            <span>Search</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
              placeholder="Reference, title, requester"
            />
          </label>
          <label className="field field--inline">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  status: event.target.value as QueueFilters['status'],
                })
              }
            >
              <option value="active">Active</option>
              <option value="all">All</option>
              {(Object.keys(statusLabels) as TicketStatus[]).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={filters.escalatedOnly}
              onChange={(event) =>
                setFilters({ ...filters, escalatedOnly: event.target.checked })
              }
            />
            Escalated only
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={filters.unassignedOnly}
              onChange={(event) =>
                setFilters({ ...filters, unassignedOnly: event.target.checked })
              }
            />
            Unassigned
          </label>
        </div>

        {load.status === 'loading' ? (
          <LoadingState label="Loading tickets…" />
        ) : null}
        {load.status === 'error' ? (
          <ErrorState message={load.error.message} onRetry={refresh} />
        ) : null}
        {load.status === 'ready' && visible.length === 0 ? (
          <EmptyState>
            <p>No tickets match these filters.</p>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setFilters(defaultFilters)}
            >
              Clear filters
            </button>
          </EmptyState>
        ) : null}

        {visible.length > 0 ? (
          <ul className="ticket-list" aria-label="Tickets">
            {visible.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  to={`/queue/${ticket.id}`}
                  className="ticket-row"
                  aria-current={ticket.id === ticketId ? 'true' : undefined}
                >
                  <span className="ticket-row__head">
                    <strong>{ticket.reference}</strong>
                    {ticket.isEscalated ? (
                      <span className="badge badge--escalated">Escalated</span>
                    ) : null}
                    <span className={`badge badge--${ticket.status}`}>
                      {statusLabels[ticket.status]}
                    </span>
                    <span className="muted">
                      {priorityLabels[ticket.priority]}
                    </span>
                  </span>
                  <span className="ticket-row__title">{ticket.title}</span>
                  <span className="muted small">
                    {ticket.requesterName} · {formatRelative(ticket.createdAt)}
                    {ticket.assigneeName ? ` · ${ticket.assigneeName}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {ticketId ? (
        <section className="split__detail" aria-label="Ticket detail">
          <Link to="/queue" className="back-link">
            ← Back to queue
          </Link>
          <TicketDetail
            key={ticketId}
            ticketId={ticketId}
            onSaved={onTicketSaved}
          />
        </section>
      ) : null}
    </div>
  );
}
