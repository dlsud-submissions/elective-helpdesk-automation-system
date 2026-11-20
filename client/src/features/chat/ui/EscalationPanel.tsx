import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  isRetryable,
  toApiError,
  type ApiError,
} from '../../../shared/api/http';
import {
  ESCALATION_SUMMARY_MAX,
  escalateToHuman,
  type EscalationReason,
  type EscalationResult,
} from '../api/escalation.api';

export type EscalationDraft = {
  title: string;
  summary: string;
  reason: EscalationReason;
};

/**
 * Confirmation step before a conversation is handed to a human agent. The
 * employee reviews (and can edit) the summary the agent will read; nothing is
 * sent until they confirm, and success is shown only after the API persisted
 * the escalation.
 */
export function EscalationPanel({
  draft,
  conversationId,
  onEscalated,
  onCancel,
}: {
  draft: EscalationDraft;
  conversationId: string | null;
  onEscalated: (result: EscalationResult) => void;
  onCancel: () => void;
}) {
  const ids = { heading: useId(), summary: useId(), hint: useId() };
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const [summary, setSummary] = useState(draft.summary);
  const [submitting, setSubmitting] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!summary.trim()) {
      setSummaryError('Describe the problem for the IT agent.');
      summaryRef.current?.focus();
      return;
    }
    setSummaryError(null);
    setSubmitting(true);
    setError(null);
    try {
      onEscalated(
        await escalateToHuman(
          {
            conversationId,
            title: draft.title,
            summary: summary.trim(),
            reason: draft.reason,
          },
          idempotencyKey.current
        )
      );
    } catch (requestError) {
      setError(toApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="panel create-ticket"
      onSubmit={onSubmit}
      aria-labelledby={ids.heading}
      noValidate
    >
      <h2 id={ids.heading} ref={headingRef} tabIndex={-1}>
        Talk to an IT agent
      </h2>
      <p className="muted">
        An IT agent will pick this up from the support queue. Check the summary
        they will read. Don't include passwords or codes.
      </p>
      <div className="field">
        <label htmlFor={ids.summary}>Summary for the agent</label>
        <textarea
          id={ids.summary}
          ref={summaryRef}
          rows={5}
          maxLength={ESCALATION_SUMMARY_MAX}
          required
          value={summary}
          aria-invalid={Boolean(summaryError)}
          aria-describedby={
            summaryError ? `${ids.summary}-error ${ids.hint}` : ids.hint
          }
          onChange={(event) => {
            // A changed summary is a different request: new idempotency key.
            idempotencyKey.current = crypto.randomUUID();
            setSummary(event.target.value);
          }}
        />
        {summaryError ? (
          <p className="field__error" id={`${ids.summary}-error`}>
            {summaryError}
          </p>
        ) : null}
        <p className="muted small" id={ids.hint}>
          Up to {ESCALATION_SUMMARY_MAX.toLocaleString()} characters.
        </p>
      </div>
      {error ? (
        <div className="alert alert--error" role="alert">
          <p>
            {error.message} Your request was not sent to an agent
            {isRetryable(error) ? ' yet. You can try again.' : '.'}
          </p>
        </div>
      ) : null}
      <div className="row">
        <button type="submit" className="button" aria-disabled={submitting}>
          {submitting
            ? 'Sending to an agent…'
            : error && isRetryable(error)
              ? 'Try again'
              : 'Send to an IT agent'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-disabled={submitting}
          onClick={() => {
            if (!submitting) onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
