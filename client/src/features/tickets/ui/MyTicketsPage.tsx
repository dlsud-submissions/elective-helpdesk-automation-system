import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toApiError, type ApiError } from '../../../shared/api/http';
import {
  DeniedState,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../../shared/ui/StatusViews';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';
import { getTicket, listTickets, updateTicket } from '../api/tickets.api';
import {
  formatRelative,
  priorityLabels,
  statusLabels,
  statusOptions,
} from '../model/queue';
import type { Ticket, TicketStatus } from '../types';

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; tickets: Ticket[] }
  | { status: 'error'; error: ApiError };

const newestFirst = (tickets: Ticket[]) =>
  [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

/** Employee requests and staff-assigned tickets, scoped to the signed-in user. */
export function MyTicketsPage({
  userId,
  role,
}: {
  userId: string;
  role: 'employee' | 'agent' | 'admin';
}) {
  const { ticketId } = useParams();
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [openFilter, setOpenFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>(
    'updated'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(
    null
  );
  useDocumentTitle(ticketId ? 'Ticket details' : 'My tickets');

  const refresh = useCallback(async () => {
    setList({ status: 'loading' });
    try {
      const tickets = await listTickets();
      setList({
        status: 'ready',
        tickets: newestFirst(
          tickets.filter((ticket) =>
            role === 'employee'
              ? ticket.requesterId === userId
              : ticket.assignedTo === userId
          )
        ),
      });
    } catch (error) {
      setList({ status: 'error', error: toApiError(error) });
    }
  }, [role, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleTickets = useMemo(() => {
    if (list.status !== 'ready') return [];
    const query = search.trim().toLocaleLowerCase();
    return list.tickets
      .filter((ticket) => {
        const matchesQuery =
          !query ||
          [ticket.reference, ticket.title, ticket.requesterName].some((value) =>
            value.toLocaleLowerCase().includes(query)
          );
        const matchesStatus =
          statusFilter === 'all' || ticket.status === statusFilter;
        const matchesOpen =
          openFilter === 'all' ||
          (openFilter === 'open' ? ticket.isOpen : !ticket.isOpen);
        return matchesQuery && matchesStatus && matchesOpen;
      })
      .sort((a, b) => {
        const comparison =
          sortBy === 'title'
            ? a.title.localeCompare(b.title)
            : sortBy === 'created'
              ? a.createdAt.localeCompare(b.createdAt)
              : a.updatedAt.localeCompare(b.updatedAt);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [list, openFilter, search, sortBy, sortDirection, statusFilter]);

  async function changeStatus(ticket: Ticket, nextStatus: TicketStatus) {
    setUpdatingTicketId(ticket.id);
    setStatusUpdateError(null);
    try {
      const updated = await updateTicket(ticket.id, {
        status: nextStatus,
        expectedUpdatedAt: ticket.updatedAt,
      });
      setList((current) =>
        current.status === 'ready'
          ? {
              ...current,
              tickets: current.tickets.map((item) =>
                item.id === updated.id ? updated : item
              ),
            }
          : current
      );
    } catch (error) {
      setStatusUpdateError(toApiError(error).message);
    } finally {
      setUpdatingTicketId(null);
    }
  }

  if (ticketId) {
    return (
      <section aria-labelledby="my-ticket-title" className="narrow">
        <Link to="/tickets" className="back-link back-link--always">
          <span aria-hidden="true">← </span>Back to my tickets
        </Link>
        <MyTicketDetail key={ticketId} ticketId={ticketId} />
      </section>
    );
  }

  return (
    <section aria-labelledby="my-tickets-title" className="narrow">
      <h1 id="my-tickets-title">My tickets</h1>
      <p className="muted">
        {role === 'employee'
          ? "Tickets you've created. Search, filter, and sort below."
          : 'Tickets assigned to you. Search, filter, and sort below.'}
      </p>
      <div
        className="filters my-tickets-filters"
        role="group"
        aria-label="Ticket search, filters, and sorting"
      >
        <label className="field field--inline">
          <span>Search tickets</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Reference, title, or requester"
          />
        </label>
        <label className="field field--inline">
          <span>Work status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {statusLabels[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--inline">
          <span>Ticket state</span>
          <select
            value={openFilter}
            onChange={(event) => setOpenFilter(event.target.value)}
          >
            <option value="all">Open and closed</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="field field--inline">
          <span>Sort by</span>
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value as 'updated' | 'created' | 'title')
            }
          >
            <option value="updated">Last updated</option>
            <option value="created">Date created</option>
            <option value="title">Title</option>
          </select>
        </label>
        <label className="field field--inline">
          <span>Sort direction</span>
          <select
            value={sortDirection}
            onChange={(event) =>
              setSortDirection(event.target.value as 'asc' | 'desc')
            }
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>
      {statusUpdateError ? (
        <div className="alert alert--error" role="alert">
          {statusUpdateError}
        </div>
      ) : null}
      {list.status === 'loading' ? (
        <LoadingState
          label={
            role === 'agent'
              ? 'Loading assigned tickets…'
              : 'Loading your tickets…'
          }
        />
      ) : null}
      {list.status === 'error' ? (
        list.error.kind === 'forbidden' ? (
          <DeniedState headingLevel={2} />
        ) : (
          <ErrorState message={list.error.message} onRetry={refresh} />
        )
      ) : null}
      {list.status === 'ready' && list.tickets.length === 0 ? (
        <EmptyState>
          <p>
            {role === 'agent'
              ? 'No tickets are assigned to you yet.'
              : "You haven't created any tickets yet."}
          </p>
          {role === 'agent' ? null : (
            <Link to="/chat" className="button button--secondary">
              Ask IT in chat
            </Link>
          )}
        </EmptyState>
      ) : null}
      {list.status === 'ready' &&
      visibleTickets.length === 0 &&
      list.tickets.length > 0 ? (
        <EmptyState>
          <p>No tickets match your search and filters.</p>
        </EmptyState>
      ) : null}
      {list.status === 'ready' && visibleTickets.length > 0 ? (
        <ul
          className="ticket-list"
          aria-label={role === 'agent' ? 'Assigned tickets' : 'Your tickets'}
        >
          {visibleTickets.map((ticket) => (
            <li key={ticket.id}>
              <div className="ticket-row">
                <Link
                  to={
                    role === 'agent'
                      ? `/dashboard/${ticket.id}`
                      : `/tickets/${ticket.id}`
                  }
                  className="ticket-row__content"
                >
                  <span className="ticket-row__head">
                    <strong>{ticket.reference}</strong>
                    {ticket.isEscalated ? (
                      <span className="badge badge--escalated">
                        Sent to an agent
                      </span>
                    ) : null}
                    <span className={`badge badge--${ticket.status}`}>
                      {statusLabels[ticket.status]}
                    </span>
                  </span>
                  <span className="ticket-row__title">{ticket.title}</span>
                  <span className="muted small">
                    Updated {formatRelative(ticket.updatedAt)}
                    {role === 'agent'
                      ? ` · Requested by ${ticket.requesterName}`
                      : ticket.assigneeName
                        ? ` · Handled by ${ticket.assigneeName}`
                        : ' · Not yet assigned'}
                  </span>
                  <span
                    className={`badge ${ticket.isOpen ? 'badge--open' : 'badge--closed'}`}
                  >
                    {ticket.isOpen ? 'Open' : 'Closed'}
                  </span>
                </Link>
                {role === 'agent' ? (
                  <div className="ticket-row__actions">
                    {ticket.conversationId &&
                    ticket.isOpen &&
                    ticket.status !== 'resolved' ? (
                      <Link
                        to={`/chat/${ticket.conversationId}`}
                        className="button button--secondary ticket-row__chat-link"
                      >
                        Open in chat
                      </Link>
                    ) : null}
                    <label className="field field--inline ticket-row__status">
                      <span>Status</span>
                      <select
                        aria-label={`Status for ${ticket.reference}`}
                        value={ticket.status}
                        disabled={updatingTicketId !== null}
                        onChange={(event) =>
                          void changeStatus(
                            ticket,
                            event.target.value as TicketStatus
                          )
                        }
                      >
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>
                            {statusLabels[option]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Read-only detail: requesters see status and their own text, no audit. */
function MyTicketDetail({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTicket((await getTicket(ticketId)).ticket);
    } catch (loadError) {
      setError(toApiError(loadError));
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (ticket) headingRef.current?.focus();
  }, [ticket]);

  if (error) {
    return (
      <>
        <h1 id="my-ticket-title">Ticket</h1>
        <ErrorState
          message={
            error.kind === 'notFound'
              ? 'This ticket could not be found.'
              : error.message
          }
          onRetry={error.kind === 'notFound' ? undefined : load}
        />
      </>
    );
  }
  if (!ticket) return <LoadingState label="Loading ticket…" />;

  return (
    <article className="panel ticket-detail">
      <p className="muted small">
        {ticket.reference} · {priorityLabels[ticket.priority]} priority
      </p>
      <h1 id="my-ticket-title" ref={headingRef} tabIndex={-1}>
        {ticket.title}
      </h1>
      <p>
        {ticket.isEscalated ? (
          <span className="badge badge--escalated">Sent to an agent</span>
        ) : null}{' '}
        <span className={`badge badge--${ticket.status}`}>
          Status: {statusLabels[ticket.status]}
        </span>{' '}
        <span
          className={`badge ${ticket.isOpen ? 'badge--open' : 'badge--closed'}`}
        >
          {ticket.isOpen ? 'Open' : 'Closed'}
        </span>
      </p>
      <dl className="details">
        <dt>Opened</dt>
        <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
        <dt>Last updated</dt>
        <dd>{new Date(ticket.updatedAt).toLocaleString()}</dd>
        <dt>Handled by</dt>
        <dd>{ticket.assigneeName ?? 'Not yet assigned'}</dd>
        {ticket.resolvedAt ? (
          <>
            <dt>Resolved</dt>
            <dd>{new Date(ticket.resolvedAt).toLocaleString()}</dd>
          </>
        ) : null}
      </dl>
      <section aria-labelledby="my-ticket-description">
        <h2 id="my-ticket-description">
          {ticket.escalationSummary
            ? 'Summary sent to the agent'
            : 'Description'}
        </h2>
        <p className="pre-line">
          {ticket.escalationSummary ?? ticket.description}
        </p>
      </section>
      {ticket.conversationId ? (
        <p>
          <Link to={`/chat/${ticket.conversationId}`}>
            Open the related chat
          </Link>
        </p>
      ) : null}
    </article>
  );
}
