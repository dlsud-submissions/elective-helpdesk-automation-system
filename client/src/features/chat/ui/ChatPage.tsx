import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isRetryable, toApiError } from '../../../shared/api/http';
import { ErrorState, LoadingState } from '../../../shared/ui/StatusViews';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';
import { CreateTicketForm, getTicket, type Ticket } from '../../tickets';
import {
  getConversationMessages,
  listConversations,
  sendChatMessage,
} from '../api/chat.api';
import type { EscalationResult } from '../api/escalation.api';
import { canSend, chatReducer, initialChatState } from '../model/chatState';
import { buildEscalationDraft } from '../model/escalationDraft';
import type { ChatMessage, Conversation } from '../types';
import { Composer } from './Composer';
import { EscalationPanel, type EscalationDraft } from './EscalationPanel';
import { MessageBubble } from './MessageBubble';

const suggestions = [
  'How do I reset my password after a lockout?',
  'I lost my phone and need an MFA reset',
  'What is included in laptop onboarding?',
];

type TicketDraft = { title: string; description: string };

/** At most one follow-up panel is open; `key` remounts it with fresh text. */
type Panel =
  | { kind: 'ticket'; key: number; draft: TicketDraft }
  | { kind: 'escalate'; key: number; draft: EscalationDraft };

type Outcome =
  | { kind: 'ticket'; ticket: Ticket }
  | { kind: 'escalated'; reference: string | null; queue: string };

function ticketDraftFrom(messages: ChatMessage[], index: number): TicketDraft {
  const question =
    [...messages.slice(0, index)].reverse().find((m) => m.senderType === 'user')
      ?.content ?? '';
  return {
    title: question.replace(/\s+/g, ' ').slice(0, 120),
    description: question
      ? `Reported in chat: ${question}`
      : 'Reported from the helpdesk chat.',
  };
}

function replyAnnouncement(message: ChatMessage): string {
  if (message.outcome === 'escalation_suggested') {
    return 'Assistant replied: no approved procedure was found. You can talk to a person or create a ticket.';
  }
  const count = message.sourceRefs.length;
  return `Assistant replied${count ? ` with ${count} source${count === 1 ? '' : 's'}` : ''}.`;
}

export function ChatPage() {
  useDocumentTitle('Chat');
  const { conversationId: routeId } = useParams();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [draft, setDraft] = useState('');
  const [conversations, setConversations] = useState<Conversation[] | null>(
    null
  );
  const [conversationsError, setConversationsError] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // A persistent live region: it exists before its text changes, so screen
  // readers announce updates reliably.
  const [announcement, setAnnouncement] = useState('');

  const titleRef = useRef<HTMLHeadingElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const panelKey = useRef(0);

  // Refs keep async callbacks honest about the latest state and block a
  // second request even before React re-renders (double click / Enter).
  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlight = useRef(false);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await listConversations());
      setConversationsError(false);
    } catch {
      setConversationsError(true);
    }
  }, []);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const loadHistory = useCallback(async (conversationId: string) => {
    dispatch({ type: 'historyRequested', conversationId });
    try {
      const { messages } = await getConversationMessages(conversationId);
      dispatch({ type: 'historyLoaded', conversationId, messages });
    } catch (error) {
      dispatch({ type: 'historyFailed', error: toApiError(error) });
    }
  }, []);

  // Sync the URL to the loaded conversation. When the URL is only catching up
  // to a conversation this page just created, nothing is reset or refetched.
  const firstSync = useRef(true);
  useEffect(() => {
    const current = stateRef.current.conversationId;
    if ((routeId ?? null) === current) return;
    setPanel(null);
    setOutcome(null);
    if (routeId) void loadHistory(routeId);
    else dispatch({ type: 'reset' });
    // Switching conversations moves focus to the page heading so keyboard
    // users start at the top of the newly loaded chat.
    if (!firstSync.current) titleRef.current?.focus();
    firstSync.current = false;
  }, [routeId, loadHistory]);

  // Keep the newest message visible above the sticky composer.
  const messageCount = state.messages.length;
  useEffect(() => {
    if (messageCount)
      lastMessageRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messageCount]);

  useEffect(() => {
    if (outcome) outcomeRef.current?.focus();
  }, [outcome]);

  const send = useCallback(
    async (content: string) => {
      if (inFlight.current || !canSend(stateRef.current)) return;
      inFlight.current = true;
      dispatch({ type: 'sendStarted', content });
      setDraft('');
      setPanel(null);
      setOutcome(null);
      setAnnouncement('Checking approved IT procedures…');
      try {
        const response = await sendChatMessage({
          conversationId: stateRef.current.conversationId,
          content,
        });
        dispatch({ type: 'sendSucceeded', response });
        setAnnouncement(replyAnnouncement(response.message));
        if (response.conversationId !== routeId) {
          navigate(`/chat/${response.conversationId}`, { replace: !routeId });
        }
        void refreshConversations();
      } catch (error) {
        dispatch({ type: 'sendFailed', error: toApiError(error) });
        setAnnouncement('');
      } finally {
        inFlight.current = false;
      }
    },
    [navigate, refreshConversations, routeId]
  );

  // Re-sends the exact failed text. Nothing was persisted for the failed
  // attempt, so this cannot duplicate the user's message.
  const retry = () => {
    const content = stateRef.current.pendingContent;
    if (content) void send(content);
  };

  const openPanel = (next: Omit<Panel, 'key'>) => {
    panelKey.current += 1;
    setOutcome(null);
    setPanel({ ...next, key: panelKey.current } as Panel);
  };

  const closePanel = () => {
    setPanel(null);
    composerRef.current?.focus();
  };

  const onEscalated = async (result: EscalationResult) => {
    setPanel(null);
    let reference: string | null = null;
    try {
      reference = (await getTicket(result.ticketId)).ticket.reference;
    } catch {
      // The escalation is persisted; only the friendly reference is missing.
    }
    setOutcome({ kind: 'escalated', reference, queue: result.queue });
  };

  const sending = state.status === 'sending';
  const empty =
    state.messages.length === 0 &&
    state.status !== 'loadingHistory' &&
    !state.pendingContent;
  const sendErrorText = state.pendingContent ?? '';

  return (
    <div className="chat-layout">
      <section className="chat-main" aria-labelledby="chat-title">
        <h1
          id="chat-title"
          className="chat-main__title"
          ref={titleRef}
          tabIndex={-1}
        >
          Ask IT
        </h1>
        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </p>

        {state.status === 'loadingHistory' ? (
          <LoadingState label="Loading conversation…" />
        ) : null}
        {state.status === 'historyError' && state.error ? (
          <ErrorState
            message={
              state.error.kind === 'notFound'
                ? 'This conversation could not be found.'
                : state.error.message
            }
            onRetry={
              state.error.kind === 'notFound' || !routeId
                ? undefined
                : () => void loadHistory(routeId)
            }
          >
            <Link to="/chat" className="button button--secondary">
              Start a new chat
            </Link>
          </ErrorState>
        ) : null}

        {empty && state.status !== 'historyError' ? (
          <div className="chat-empty">
            <h2>How can we help?</h2>
            <p className="muted">
              Answers come from approved IT procedures and list their sources.
            </p>
            <p className="muted small">Try:</p>
            <div className="suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setDraft(suggestion);
                    composerRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <h2 className="visually-hidden">Messages</h2>
        {/* aria-live is off: loading a whole conversation must not read every
            message aloud. New replies are announced by the status region. */}
        <div
          className="message-log"
          role="log"
          aria-live="off"
          aria-label="Conversation"
          aria-busy={state.status === 'loadingHistory'}
        >
          {state.messages.map((message, index) => (
            <div
              key={message.id}
              className="message-slot"
              ref={
                index === state.messages.length - 1 ? lastMessageRef : undefined
              }
            >
              <MessageBubble
                message={message}
                onCreateTicket={
                  message.senderType === 'assistant'
                    ? () =>
                        openPanel({
                          kind: 'ticket',
                          draft: ticketDraftFrom(state.messages, index),
                        })
                    : undefined
                }
                onEscalate={
                  message.senderType === 'assistant'
                    ? () =>
                        openPanel({
                          kind: 'escalate',
                          draft: buildEscalationDraft(state.messages, index),
                        })
                    : undefined
                }
              />
            </div>
          ))}

          {state.pendingContent ? (
            <article
              className="message message--user message--pending"
              aria-label="Your message"
            >
              <p className="message__meta">
                You {sending ? '· sending' : '· not sent'}
              </p>
              <p className="message__body pre-line">{state.pendingContent}</p>
            </article>
          ) : null}
        </div>

        {sending ? (
          <p className="message message--assistant typing">
            <span className="dots" aria-hidden="true">
              ● ● ●
            </span>{' '}
            Checking approved IT procedures…
          </p>
        ) : null}

        {state.status === 'sendError' && state.error ? (
          <ErrorState
            message={
              state.error.kind === 'timeout'
                ? 'The assistant took too long to respond.'
                : state.error.message
            }
            onRetry={isRetryable(state.error) ? retry : undefined}
          >
            {isRetryable(state.error) ? (
              <span className="muted small">Your message was not lost.</span>
            ) : null}
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                openPanel({
                  kind: 'ticket',
                  draft: {
                    title: sendErrorText.slice(0, 120),
                    description: `Reported in chat: ${sendErrorText}`,
                  },
                })
              }
            >
              Create a ticket instead
            </button>
          </ErrorState>
        ) : null}

        {panel?.kind === 'ticket' ? (
          <CreateTicketForm
            key={panel.key}
            initialTitle={panel.draft.title}
            initialDescription={panel.draft.description}
            conversationId={state.conversationId}
            onCancel={closePanel}
            onCreated={(ticket) => {
              setPanel(null);
              setOutcome({ kind: 'ticket', ticket });
            }}
          />
        ) : null}
        {panel?.kind === 'escalate' ? (
          <EscalationPanel
            key={panel.key}
            draft={panel.draft}
            conversationId={state.conversationId}
            onCancel={closePanel}
            onEscalated={(result) => void onEscalated(result)}
          />
        ) : null}

        {outcome ? (
          <div
            className="alert alert--success"
            role="status"
            ref={outcomeRef}
            tabIndex={-1}
          >
            {outcome.kind === 'ticket' ? (
              <p>
                <strong>Ticket {outcome.ticket.reference} created.</strong>{' '}
                Status: {outcome.ticket.status}. The IT team will follow up.
              </p>
            ) : (
              <p>
                <strong>
                  Sent to an IT agent
                  {outcome.reference ? ` as ${outcome.reference}` : ''}.
                </strong>{' '}
                It is in the {outcome.queue} queue. An agent will follow up.
              </p>
            )}
            <p>
              <Link to="/tickets">View my tickets</Link>
            </p>
          </div>
        ) : null}

        <Composer
          value={draft}
          onChange={setDraft}
          onSend={(content) => void send(content)}
          sending={sending}
          disabled={state.status === 'loadingHistory'}
          inputRef={composerRef}
        />
      </section>

      {/* After the chat in the DOM so keyboard and screen-reader order match
          the narrow layout; CSS places it on the left on wide screens. */}
      <aside className="chat-sidebar" aria-label="Conversations">
        <Link to="/chat" className="button button--block">
          New chat
        </Link>
        {conversations === null && !conversationsError ? (
          <p className="muted small">Loading past conversations…</p>
        ) : null}
        {conversationsError ? (
          <p className="muted small" role="status">
            Could not load past conversations.{' '}
            <button
              type="button"
              className="link-button"
              onClick={refreshConversations}
            >
              Retry
            </button>
          </p>
        ) : null}
        {conversations && conversations.length > 0 ? (
          <ul className="conversation-list">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  to={`/chat/${conversation.id}`}
                  title={conversation.title}
                  aria-current={
                    conversation.id === routeId ? 'page' : undefined
                  }
                >
                  {conversation.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {conversations && conversations.length === 0 ? (
          <p className="muted small">No past conversations yet.</p>
        ) : null}
      </aside>
    </div>
  );
}
