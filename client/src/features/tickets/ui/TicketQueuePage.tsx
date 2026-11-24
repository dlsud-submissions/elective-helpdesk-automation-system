import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toApiError, type ApiError } from '../../../shared/api/http';
import {
  DeniedState,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../../shared/ui/StatusViews';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';
import {
  listKbSubmissions,
  reviewKbSubmission,
  type KbSubmission,
} from '../../knowledge/api/kb-submissions.api';
import { listStaff, listTickets } from '../api/tickets.api';
import {
  defaultFilters,
  filterQueue,
  formatRelative,
  priorityLabels,
  statusLabels,
  type QueueFilters,
} from '../model/queue';
import type { StaffMember, Ticket, TicketStatus } from '../types';
import { TicketDetail } from './TicketDetail';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; tickets: Ticket[]; staff: StaffMember[] }
  | { status: 'error'; error: ApiError };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

// ─── Tickets subtab ──────────────────────────────────────────────────────────

function TicketsTab({
  ticketId,
  onTicketSaved,
}: {
  ticketId: string | undefined;
  onTicketSaved: (ticket: Ticket) => void;
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [filters, setFilters] = useState<QueueFilters>(defaultFilters);

  const lastOpened = useRef<string | null>(null);
  useEffect(() => {
    if (ticketId) {
      lastOpened.current = ticketId;
      return;
    }
    const previous = lastOpened.current;
    lastOpened.current = null;
    if (!previous) return;
    document
      .querySelector<HTMLElement>(`[data-ticket-id="${CSS.escape(previous)}"]`)
      ?.focus();
  }, [ticketId]);

  const refresh = useCallback(async () => {
    try {
      const [tickets, staff] = await Promise.all([listTickets(), listStaff()]);
      setLoad({ status: 'ready', tickets, staff });
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

  if (load.status === 'error' && load.error.kind === 'forbidden') {
    return <DeniedState />;
  }

  return (
    <div className={`split ${ticketId ? 'split--detail' : ''}`}>
      <section className="split__list" aria-labelledby="queue-tickets-title">
        <h2 id="queue-tickets-title" className="visually-hidden">
          Tickets
        </h2>
        <div className="filters" role="group" aria-label="Queue filters">
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
          <label className="field field--inline">
            <span>Assigned</span>
            <select
              value={filters.assignedTo}
              onChange={(event) =>
                setFilters({ ...filters, assignedTo: event.target.value })
              }
            >
              <option value="all">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {load.status === 'ready'
                ? load.staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))
                : null}
            </select>
          </label>
          <label className="field field--inline">
            <span>Created from</span>
            <input
              type="date"
              value={filters.createdFrom}
              onChange={(event) =>
                setFilters({ ...filters, createdFrom: event.target.value })
              }
            />
          </label>
          <label className="field field--inline">
            <span>Created to</span>
            <input
              type="date"
              value={filters.createdTo}
              onChange={(event) =>
                setFilters({ ...filters, createdTo: event.target.value })
              }
            />
          </label>
        </div>

        <p className="visually-hidden" role="status" aria-live="polite">
          {load.status === 'ready'
            ? `${visible.length} ${visible.length === 1 ? 'ticket' : 'tickets'} shown.`
            : ''}
        </p>

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
                  data-ticket-id={ticket.id}
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
            <span aria-hidden="true">←</span>Back to queue
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

// ─── Solutions subtab (KB Queue) ─────────────────────────────────────────────

function SolutionsTab() {
  const [submissions, setSubmissions] = useState<KbSubmission[] | null>(null);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await listKbSubmissions('pending');
      setSubmissions(data);
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, status: 'accepted' | 'denied') => {
    setReviewing(id);
    try {
      await reviewKbSubmission(id, status, noteMap[id]);
      await load();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setReviewing(null);
    }
  };

  return (
    <section className="narrow" aria-labelledby="queue-solutions-title">
      <p className="muted">
        Review agent-submitted problem → solution pairs before they are saved to
        the knowledge base.
      </p>

      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}

      {submissions === null ? (
        <LoadingState label="Loading submissions…" />
      ) : submissions.length === 0 ? (
        <p className="muted">No pending submissions.</p>
      ) : (
        <ul className="kb-submission-list">
          {submissions.map((sub) => (
            <li key={sub.id} className="panel kb-submission-card">
              <div className="kb-submission-card__meta">
                <span className="muted small">
                  Submitted by <strong>{sub.agentName}</strong> ·{' '}
                  {formatDate(sub.createdAt)}
                  {sub.ticketReference ? ` · ${sub.ticketReference}` : ''}
                </span>
              </div>

              <section aria-label="Employee problem">
                <h3 className="kb-submission-card__label">Employee problem</h3>
                <p className="pre-line kb-submission-card__text">{sub.input}</p>
              </section>

              <section aria-label="Agent solution">
                <h3 className="kb-submission-card__label">Agent solution</h3>
                <p className="pre-line kb-submission-card__text">
                  {sub.solution}
                </p>
              </section>

              <div className="field">
                <label htmlFor={`note-${sub.id}`} className="muted small">
                  Admin note (optional)
                </label>
                <input
                  id={`note-${sub.id}`}
                  type="text"
                  className="kb-submission-card__note"
                  value={noteMap[sub.id] ?? ''}
                  onChange={(e) =>
                    setNoteMap((prev) => ({
                      ...prev,
                      [sub.id]: e.target.value,
                    }))
                  }
                  placeholder="Reason for accept / deny…"
                  disabled={reviewing === sub.id}
                />
              </div>

              <div className="kb-submission-card__actions">
                <button
                  type="button"
                  className="button"
                  disabled={reviewing === sub.id}
                  onClick={() => void review(sub.id, 'accepted')}
                >
                  {reviewing === sub.id ? 'Saving…' : 'Accept'}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={reviewing === sub.id}
                  onClick={() => void review(sub.id, 'denied')}
                >
                  Deny
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type QueueTab = 'tickets' | 'solutions';

export function TicketQueuePage() {
  const { ticketId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: QueueTab = rawTab === 'solutions' ? 'solutions' : 'tickets';

  useDocumentTitle(ticketId ? 'Ticket details' : 'Queue');

  const setTab = (tab: QueueTab) => {
    setSearchParams(tab === 'tickets' ? {} : { tab });
  };

  // ticket save handler is lifted here so TicketsTab can be a child
  const handleTicketSaved = useCallback((_ticket: Ticket) => {
    // TicketsTab manages its own state; this callback is a no-op at this level
  }, []);

  if (ticketId) {
    // When a ticket detail is open, always show the tickets tab content
    return (
      <div className="queue-page">
        <TicketsTab ticketId={ticketId} onTicketSaved={handleTicketSaved} />
      </div>
    );
  }

  return (
    <div className="queue-page">
      <div className="queue-page__header">
        <h1 id="queue-title">Queue</h1>
      </div>

      {/* Subtabs */}
      <div className="subtabs" role="tablist" aria-label="Queue sections">
        <button
          role="tab"
          type="button"
          className={`subtab${activeTab === 'tickets' ? ' subtab--active' : ''}`}
          aria-selected={activeTab === 'tickets'}
          onClick={() => setTab('tickets')}
        >
          Tickets
        </button>
        <button
          role="tab"
          type="button"
          className={`subtab${activeTab === 'solutions' ? ' subtab--active' : ''}`}
          aria-selected={activeTab === 'solutions'}
          onClick={() => setTab('solutions')}
        >
          Solutions
        </button>
      </div>

      <div
        role="tabpanel"
        aria-label={activeTab === 'tickets' ? 'Tickets' : 'Solutions'}
      >
        {activeTab === 'tickets' ? (
          <TicketsTab ticketId={undefined} onTicketSaved={handleTicketSaved} />
        ) : (
          <SolutionsTab />
        )}
      </div>
    </div>
  );
}
