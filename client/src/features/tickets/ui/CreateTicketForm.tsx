import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toApiError } from '../../../shared/api/http';
import { createTicket } from '../api/tickets.api';
import type { Ticket, TicketPriority } from '../types';

type FieldErrors = { title?: string; description?: string };

/**
 * Employee ticket form, prefilled from a chat question. A confirmation is
 * shown only after the API returns the persisted ticket.
 */
export function CreateTicketForm({
  initialTitle,
  initialDescription,
  conversationId,
  onCreated,
  onCancel,
}: {
  initialTitle: string;
  initialDescription: string;
  /** The chat this ticket came from; the API checks the caller owns it. */
  conversationId?: string | null;
  onCreated: (ticket: Ticket) => void;
  onCancel: () => void;
}) {
  const ids = {
    heading: useId(),
    title: useId(),
    description: useId(),
    priority: useId(),
  };
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const [title, setTitle] = useState(initialTitle.slice(0, 120));
  const [description, setDescription] = useState(initialDescription);
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  // Opening the form moves focus into it so keyboard and screen-reader users
  // land on the new content instead of staying on the button that opened it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Any edit makes this a different request, so it gets a new key. A retry of
  // the unchanged form keeps the key and cannot create a duplicate ticket.
  const edited = () => {
    idempotencyKey.current = crypto.randomUUID();
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const errors: FieldErrors = {
      ...(title.trim() ? {} : { title: 'Add a short title.' }),
      ...(description.trim() ? {} : { description: 'Describe the problem.' }),
    };
    setFieldErrors(errors);
    if (errors.title || errors.description) {
      (errors.title ? titleRef : descriptionRef).current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onCreated(
        await createTicket(
          {
            title: title.trim(),
            description: description.trim(),
            priority,
            ...(conversationId ? { conversationId } : {}),
          },
          idempotencyKey.current
        )
      );
    } catch (requestError) {
      setError(toApiError(requestError).message);
    } finally {
      setSubmitting(false);
    }
  }

  const describedBy = (field: keyof FieldErrors, id: string) =>
    fieldErrors[field] ? `${id}-error` : undefined;

  return (
    <form
      className="panel create-ticket"
      onSubmit={onSubmit}
      aria-labelledby={ids.heading}
      noValidate
    >
      <h2 id={ids.heading} ref={headingRef} tabIndex={-1}>
        Create a ticket
      </h2>
      <div className="field">
        <label htmlFor={ids.title}>Title</label>
        <input
          id={ids.title}
          ref={titleRef}
          value={title}
          maxLength={120}
          required
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={describedBy('title', ids.title)}
          onChange={(event) => {
            edited();
            setTitle(event.target.value);
          }}
        />
        {fieldErrors.title ? (
          <p className="field__error" id={`${ids.title}-error`}>
            {fieldErrors.title}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor={ids.description}>Description</label>
        <textarea
          id={ids.description}
          ref={descriptionRef}
          rows={4}
          maxLength={5000}
          required
          value={description}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={describedBy('description', ids.description)}
          onChange={(event) => {
            edited();
            setDescription(event.target.value);
          }}
        />
        {fieldErrors.description ? (
          <p className="field__error" id={`${ids.description}-error`}>
            {fieldErrors.description}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor={ids.priority}>Priority</label>
        <select
          id={ids.priority}
          value={priority}
          onChange={(event) => {
            edited();
            setPriority(event.target.value as TicketPriority);
          }}
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
        {/* aria-disabled keeps the focused button in place while submitting. */}
        <button type="submit" className="button" aria-disabled={submitting}>
          {submitting ? 'Creating…' : 'Create ticket'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            if (!submitting) onCancel();
          }}
          aria-disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
