import { useCallback, useEffect, useId, useState } from 'react';
import { toApiError } from '../../../shared/api/http';
import { LoadingState } from '../../../shared/ui/StatusViews';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';
import {
  listKnowledgeArticles,
  listKbSubmissions,
  reviewKbSubmission,
  submitKbPair,
  type KnowledgeArticle,
  type KbSubmission,
} from '../api/kb-submissions.api';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

/** Unified view of a KB entry — either a seeded article or an accepted submission. */
type DisplayArticle = {
  id: string;
  title: string;
  body: string;
  category: string;
  source: string;
  sourceLabel: string;
  date?: string;
};

function articleFromKnowledge(a: KnowledgeArticle): DisplayArticle {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    category: a.category,
    source: a.sourceName,
    sourceLabel: a.source === 'seed' ? 'Seeded' : 'Knowledge Base',
  };
}

function articleFromSubmission(s: KbSubmission): DisplayArticle {
  return {
    id: s.id,
    title: s.input.slice(0, 80) + (s.input.length > 80 ? '…' : ''),
    body: s.solution,
    category: 'agent-submitted',
    source: s.agentName,
    sourceLabel: 'Agent submission',
    date: s.updatedAt,
  };
}

export function KbArticlesPage() {
  useDocumentTitle('Knowledge Base');
  const [articles, setArticles] = useState<DisplayArticle[] | null>(null);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [knowledgeArticles, acceptedSubmissions] = await Promise.all([
        listKnowledgeArticles(),
        listKbSubmissions('accepted'),
      ]);
      const all: DisplayArticle[] = [
        ...knowledgeArticles.map(articleFromKnowledge),
        ...acceptedSubmissions.map(articleFromSubmission),
      ];
      setArticles(all);
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreated = (article: DisplayArticle) => {
    setArticles((prev) => [article, ...(prev ?? [])]);
    setShowNew(false);
  };

  return (
    <section className="narrow" aria-labelledby="kb-articles-title">
      <div className="kb-articles-header">
        <h1 id="kb-articles-title">Knowledge Base</h1>
        <button
          type="button"
          className="button"
          onClick={() => setShowNew((v) => !v)}
        >
          {showNew ? 'Cancel' : '+ New'}
        </button>
      </div>
      <p className="muted">
        All problem → solution knowledge used by Harbor to answer employee
        questions. Includes seeded articles and accepted agent submissions.
      </p>

      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}

      {showNew ? (
        <NewKbPairForm
          onCreated={handleCreated}
          onCancel={() => setShowNew(false)}
        />
      ) : null}

      {articles === null ? (
        <LoadingState label="Loading knowledge base…" />
      ) : articles.length === 0 && !showNew ? (
        <p className="muted">
          No articles yet. Accept submissions from the Solutions queue, or
          create one with the New button.
        </p>
      ) : (
        <ul className="kb-article-list">
          {articles.map((article) => (
            <li key={article.id} className="panel kb-article-card">
              <div className="muted small kb-article-card__meta">
                <span className="badge badge--role">{article.sourceLabel}</span>{' '}
                <strong>{article.source}</strong>
                {article.date ? ` · ${formatDate(article.date)}` : ''}
                {article.category ? (
                  <span className="kb-article-card__category">
                    {' '}
                    · {article.category}
                  </span>
                ) : null}
              </div>
              <section aria-label="Problem / Title">
                <h3 className="kb-submission-card__label">Problem / Title</h3>
                <p className="pre-line kb-submission-card__text">
                  {article.title}
                </p>
              </section>
              <section aria-label="Solution">
                <h3 className="kb-submission-card__label">Solution</h3>
                <p className="pre-line kb-submission-card__text">
                  {article.body}
                </p>
              </section>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type KbPair = {
  id: string;
  title: string;
  body: string;
  category: string;
  source: string;
  sourceLabel: string;
  date?: string;
};

function submissionToDisplayArticle(sub: KbSubmission): KbPair {
  return {
    id: sub.id,
    title: sub.input.slice(0, 80) + (sub.input.length > 80 ? '…' : ''),
    body: sub.solution,
    category: 'agent-submitted',
    source: sub.agentName,
    sourceLabel: 'Agent submission',
    date: sub.updatedAt,
  };
}

function NewKbPairForm({
  onCreated,
  onCancel,
}: {
  onCreated: (article: DisplayArticle) => void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const solutionId = useId();
  const [inputText, setInputText] = useState('');
  const [solution, setSolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async () => {
    if (!inputText.trim() || !solution.trim()) {
      setFormError('Both fields are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const sub = await submitKbPair({
        input: inputText.trim(),
        solution: solution.trim(),
      });
      const accepted = await reviewKbSubmission(
        sub.id,
        'accepted',
        'Created directly by admin'
      );
      onCreated(submissionToDisplayArticle(accepted));
    } catch (err) {
      setFormError(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel kb-new-form">
      <h2>New KB pair</h2>
      {formError ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor={inputId}>Employee problem / question</label>
        <textarea
          id={inputId}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Describe the problem or question…"
          disabled={saving}
        />
      </div>
      <div className="field">
        <label htmlFor={solutionId}>Solution</label>
        <textarea
          id={solutionId}
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          rows={5}
          maxLength={8000}
          placeholder="Provide the solution or answer…"
          disabled={saving}
        />
      </div>
      <div className="kb-submission-card__actions">
        <button
          type="button"
          className="button"
          disabled={saving || !inputText.trim() || !solution.trim()}
          onClick={() => void handleSubmit()}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
