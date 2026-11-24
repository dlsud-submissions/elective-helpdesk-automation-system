import { useCallback, useEffect, useState } from 'react';
import { toApiError } from '../../../shared/api/http';
import { LoadingState } from '../../../shared/ui/StatusViews';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';
import {
  listKbSubmissions,
  reviewKbSubmission,
  type KbSubmission,
} from '../api/kb-submissions.api';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export function KbSubmissionsPage() {
  useDocumentTitle('KB Approval Queue');
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
    <section className="narrow" aria-labelledby="kb-queue-title">
      <h1 id="kb-queue-title">KB Approval Queue</h1>
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
