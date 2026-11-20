import type { ChatMessage, SourceRef } from '../types';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

export function SourceList({
  sources,
  messageId,
}: {
  sources: SourceRef[];
  messageId: string;
}) {
  if (!sources.length) return null;
  return (
    <section className="sources" aria-labelledby={`${messageId}-sources`}>
      <h3 id={`${messageId}-sources`} className="sources__title">
        Sources
      </h3>
      <ol className="sources__list">
        {sources.map((source, index) => (
          <li key={`${source.articleId}-${index}`}>
            <details>
              {/* No aria-label: the visible marker, title and source name are
                  the accessible name, so voice-control users can say them. */}
              <summary>
                <span className="sources__marker">[{index + 1}]</span>{' '}
                {source.title}
                {source.sourceName ? (
                  <span className="muted small"> · {source.sourceName}</span>
                ) : null}
              </summary>
              <blockquote className="sources__excerpt">
                {source.excerpt}
              </blockquote>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function MessageBubble({
  message,
  onCreateTicket,
  onEscalate,
}: {
  message: ChatMessage;
  onCreateTicket?: () => void;
  onEscalate?: () => void;
}) {
  if (message.senderType === 'user') {
    return (
      <article className="message message--user" aria-label="You">
        <p className="message__meta">
          You{' '}
          <time dateTime={message.createdAt}>
            {formatTime(message.createdAt)}
          </time>
        </p>
        <p className="message__body pre-line">{message.content}</p>
      </article>
    );
  }

  const uncertain = message.outcome === 'escalation_suggested';
  const clarification = message.outcome === 'clarification';

  return (
    <article
      className={`message message--assistant${uncertain ? ' message--uncertain' : ''}`}
      aria-label="Assistant"
    >
      <p className="message__meta">
        Assistant{' '}
        <time dateTime={message.createdAt}>
          {formatTime(message.createdAt)}
        </time>
      </p>
      {uncertain ? (
        <p className="badge badge--warning">No approved procedure found</p>
      ) : null}
      {clarification ? (
        <p className="badge badge--info">More details needed</p>
      ) : null}
      <div className="message__body pre-line">{message.content}</div>
      <SourceList sources={message.sourceRefs} messageId={message.id} />
      {(onCreateTicket || onEscalate) &&
      (message.outcome === 'answered' || uncertain) ? (
        <div className="message__actions">
          <span className="muted small">
            {uncertain ? 'Need more help?' : 'Did this not solve it?'}
          </span>
          {onEscalate ? (
            <button
              type="button"
              className={uncertain ? 'button' : 'button button--secondary'}
              onClick={onEscalate}
            >
              Talk to a person
            </button>
          ) : null}
          {onCreateTicket ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={onCreateTicket}
            >
              {uncertain ? 'Create a ticket' : 'No, create a ticket'}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
