import { useId, useState, type FormEvent } from 'react';
import { toApiError } from '../../../shared/api/http';
import { createTicket } from '../api/tickets.api';
import type { Ticket, TicketPriority } from '../types';

/**
 * Employee ticket form, prefilled from a chat question. A confirmation is
 * shown only after the API returns the persisted ticket.
 */
export function CreateTicketForm({
  initialTitle,
  initialDescription,
  onCreated,
  onCancel,
}: {
  initialTitle: string;
  initialDescription: string;
  onCreated: (ticket: Ticket) => void;
  onCancel: () => void;
}) {
  const ids = { title: useId(), description: useId(), priority: useId() };
  const [title, setTitle] = useState(initialTitle.slice(0, 120));
  const [description, setDescription] = useState(initialDescription);
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Add a title and description.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onCreated(
        await createTicket({
          title: title.trim(),
          description: description.trim(),
          priority,
        })
      );
    } catch (requestError) {
      setError(toApiError(requestError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="panel create-ticket"
      onSubmit={onSubmit}
      aria-label="Create a ticket"
    >
      <h3>Create a ticket</h3>
      <div className="field">
        <label htmlFor={ids.title}>Title</label>
        <input
          id={ids.title}
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={ids.description}>Description</label>
        <textarea
          id={ids.description}
          rows={4}
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={ids.priority}>Priority</label>
        <select
          id={ids.priority}
          value={priority}
          onChange={(event) =>
            setPriority(event.target.value as TicketPriority)
          }
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create ticket'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
