import type { ChatMessage, SourceRef } from '../types';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

/** Harbor AI avatar — uses the public logo-harbor.png placed in /public */
function HarborAvatar() {
  return (
    <img
      src="/assets/logo-harbor.png"
      alt="Harbor"
      className="harbor-avatar"
      width={28}
      height={28}
    />
  );
}

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
  /** When true, 'user' messages are shown as sent by the employee, not "You". */
  isAgentView = false,
  /**
   * Display name for the agent who sent an 'agent'-type message.
   * - When isAgentView is true (the agent is viewing their own message) this is
   *   ignored and "You" is shown instead.
   * - When false (employee view) this name is shown as the sender label.
   */
  agentDisplayName,
}: {
  message: ChatMessage;
  onCreateTicket?: () => void;
  isAgentView?: boolean;
  agentDisplayName?: string;
}) {
  if (message.senderType === 'user') {
    // Agents viewing a conversation see this as the employee's message, not theirs.
    const label = isAgentView ? 'Employee' : 'You';
    return (
      <article
        className={`message message--user${isAgentView ? ' message--employee' : ''}`}
        aria-label={label}
      >
        <p className="message__meta">
          {label}{' '}
          <time dateTime={message.createdAt}>
            {formatTime(message.createdAt)}
          </time>
        </p>
        <p className="message__body pre-line">{message.content}</p>
      </article>
    );
  }

  if (message.senderType === 'agent') {
    // Agents viewing a conversation always see their OWN message (they only
    // have access to conversations linked to tickets assigned to them). Show
    // "You" right-aligned just like a regular user bubble, using the existing
    // message--user styles. For employees, show the agent's display name.
    const agentLabel = agentDisplayName ?? 'IT agent';
    if (isAgentView) {
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
    return (
      <article
        className="message message--assistant message--agent"
        aria-label={agentLabel}
      >
        <p className="message__meta">
          {agentLabel}{' '}
          <time dateTime={message.createdAt}>
            {formatTime(message.createdAt)}
          </time>
        </p>
        <p className="message__body pre-line">{message.content}</p>
      </article>
    );
  }

  if (message.senderType === 'system') {
    return (
      <article
        className="message message--assistant"
        aria-label="Ticket details"
      >
        <p className="message__meta">
          Ticket details{' '}
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
      className={`message message--assistant message--harbor${uncertain ? ' message--uncertain' : ''}`}
      aria-label="Harbor"
    >
      <p className="message__meta message__meta--harbor">
        <HarborAvatar />
        Harbor{' '}
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
      {onCreateTicket && (message.outcome === 'answered' || uncertain) ? (
        <div className="message__actions">
          <span className="muted small">
            {uncertain ? 'Need more help?' : 'Did this not solve it?'}
          </span>
          <button
            type="button"
            className={uncertain ? 'button' : 'button button--secondary'}
            onClick={onCreateTicket}
          >
            Create a ticket
          </button>
        </div>
      ) : null}
    </article>
  );
}
