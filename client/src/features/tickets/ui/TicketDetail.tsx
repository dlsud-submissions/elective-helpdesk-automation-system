import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { toApiError, type ApiError } from '../../../shared/api/http';
import {
  DeniedState,
  ErrorState,
  LoadingState,
} from '../../../shared/ui/StatusViews';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';
import { useProfile } from '../../auth';
import { getTicket, listStaff, updateTicket } from '../api/tickets.api';
import { priorityLabels, statusLabels, statusOptionsFor } from '../model/queue';
import type { StaffMember, Ticket, TicketStatus } from '../types';

type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; message: string }
  | { status: 'failed'; error: ApiError };

export function TicketDetail({
  ticketId,
  onSaved,
}: {
  ticketId: string;
  onSaved: (ticket: Ticket) => void;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [status, setStatus] = useState<TicketStatus>('new');
  const [assignee, setAssignee] = useState('');
  const [save, setSave] = useState<SaveState>({ status: 'idle' });
  const profile = useProfile();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const loadCount = useRef(0);
  const [loaded, setLoaded] = useState(0);
  useDocumentTitle(
    ticket ? `${ticket.reference} · Ticket queue` : 'Ticket details'
  );

  // Each completed load (opening a ticket or 'Reload ticket') moves focus to
  // the ticket heading: on narrow screens the list that had focus is hidden.
  useEffect(() => {
    if (loaded) headingRef.current?.focus();
  }, [loaded]);

  const load = useCallback(async () => {
    setLoadError(null);
    setTicket(null);
    try {
      const [detail, agents] = await Promise.all([
        getTicket(ticketId),
        profile.role === 'admin' ? listStaff() : Promise.resolve([]),
      ]);
      setTicket(detail.ticket);
      setStaff(agents);
      setStatus(detail.ticket.status);
      setAssignee(detail.ticket.assignedTo ?? '');
      loadCount.current += 1;
      setLoaded(loadCount.current);
    } catch (error) {
      setLoadError(toApiError(error));
    }
  }, [profile.role, ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError?.kind === 'forbidden') return <DeniedState headingLevel={2} />;
  if (loadError) {
    return <ErrorState message={loadError.message} onRetry={load} />;
  }
  if (!ticket) return <LoadingState label="Loading ticket…" />;

  const dirty =
    status !== ticket.status || assignee !== (ticket.assignedTo ?? '');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ticket || !dirty || save.status === 'saving') return;
    setSave({ status: 'saving' });
    try {
      const updated = await updateTicket(ticket.id, {
        expectedUpdatedAt: ticket.updatedAt,
        ...(status !== ticket.status ? { status } : {}),
        ...(assignee !== (ticket.assignedTo ?? '')
          ? { assigneeId: assignee || null }
          : {}),
      });
      setTicket(updated);
      setStatus(updated.status);
      setAssignee(updated.assignedTo ?? '');
      onSaved(updated);
      setSave({
        status: 'saved',
        message: `Saved. Status is ${statusLabels[updated.status]}${
          updated.assigneeName ? `, assigned to ${updated.assigneeName}` : ''
        }.`,
      });
    } catch (error) {
      // Revert to the persisted values so the UI never shows unsaved state.
      setStatus(ticket.status);
      setAssignee(ticket.assignedTo ?? '');
      setSave({ status: 'failed', error: toApiError(error) });
    }
  }

  const saveError =
    save.status === 'failed'
      ? save.error.kind === 'forbidden'
        ? "You don't have permission to update this ticket."
        : save.error.message
      : null;

  return (
    <article className="panel ticket-detail" aria-labelledby="ticket-title">
      <header>
        <p className="muted small">
          {ticket.reference} · {priorityLabels[ticket.priority]} priority
        </p>
        <h2 id="ticket-title" ref={headingRef} tabIndex={-1}>
          {ticket.title}
        </h2>
        <p className="muted small">
          Requester: {ticket.requesterName} · Category: {ticket.category} ·
          Opened {new Date(ticket.createdAt).toLocaleString()}
        </p>
        <p>
          {ticket.isEscalated ? (
            <span className="badge badge--escalated">Escalated</span>
          ) : null}{' '}
          <span className={`badge badge--${ticket.status}`}>
            {statusLabels[ticket.status]}
          </span>
        </p>
      </header>

      {ticket.escalationSummary ? (
        <section className="callout" aria-labelledby="summary-title">
          <h3 id="summary-title">
            Escalation summary{' '}
            <span className="muted small">
              (AI-generated, check before acting)
            </span>
          </h3>
          <p className="pre-line">{ticket.escalationSummary}</p>
        </section>
      ) : (
        <section aria-labelledby="description-title">
          <h3 id="description-title">Description</h3>
          <p className="pre-line">{ticket.description}</p>
        </section>
      )}

      <form className="ticket-actions" onSubmit={onSubmit}>
        <label className="field field--inline">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as TicketStatus)}
            disabled={save.status === 'saving'}
          >
            {statusOptionsFor(ticket.status).map((option) => (
              <option key={option} value={option}>
                {statusLabels[option]}
              </option>
            ))}
          </select>
        </label>
        {profile.role === 'admin' ? (
          <label className="field field--inline">
            <span>Assigned to</span>
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              disabled={save.status === 'saving'}
            >
              <option value="">Unassigned</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="submit"
          className="button"
          // aria-disabled, not disabled: the focused button must stay
          // focusable while saving and after a successful save.
          aria-disabled={!dirty || save.status === 'saving'}
        >
          {save.status === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </form>

      {save.status === 'saved' ? (
        <p className="alert alert--success" role="status">
          {save.message}
        </p>
      ) : null}

      {saveError ? (
        <div className="alert alert--error" role="alert">
          <p>{saveError}</p>
          {save.status === 'failed' && save.error.kind === 'conflict' ? (
            <button type="button" className="button" onClick={load}>
              Reload ticket
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
