import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toApiError, type ApiError } from '../../../shared/api/http';
import {
  DeniedState,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../../shared/ui/StatusViews';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';
import { getTicket, listTickets } from '../api/tickets.api';
import { formatRelative, priorityLabels, statusLabels } from '../model/queue';
import type { Ticket } from '../types';

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
          ? 'Tickets you created, newest first.'
          : 'Tickets assigned to you, newest first.'}
      </p>
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
      {list.status === 'ready' && list.tickets.length > 0 ? (
        <ul
          className="ticket-list"
          aria-label={role === 'agent' ? 'Assigned tickets' : 'Your tickets'}
        >
          {list.tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                to={
                  role === 'agent'
                    ? `/dashboard/${ticket.id}`
                    : `/tickets/${ticket.id}`
                }
                className="ticket-row"
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
              </Link>
              {role === 'agent' &&
              ticket.conversationId &&
              ticket.status !== 'resolved' &&
              ticket.status !== 'closed' ? (
                <Link
                  to={`/chat/${ticket.conversationId}`}
                  className="button button--secondary ticket-row__chat-link"
                >
                  Open in chat
                </Link>
              ) : null}
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
