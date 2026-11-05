import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toApiError } from '../../../shared/api/http';
import { ErrorState, LoadingState } from '../../../shared/ui/StatusViews';
import { CreateTicketForm, type Ticket } from '../../tickets';
import {
  getConversationMessages,
  listConversations,
  sendChatMessage,
} from '../api/chat.api';
import { canSend, chatReducer, initialChatState } from '../model/chatState';
import type { ChatMessage, Conversation } from '../types';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';

const suggestions = [
  'How do I reset my password after a lockout?',
  'I lost my phone and need an MFA reset',
  'What is included in laptop onboarding?',
];

type TicketDraft = { title: string; description: string };

function draftFrom(messages: ChatMessage[], index: number): TicketDraft {
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

export function ChatPage() {
  const { conversationId: routeId } = useParams();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [draft, setDraft] = useState('');
  const [conversations, setConversations] = useState<Conversation[] | null>(
    null
  );
  const [conversationsError, setConversationsError] = useState(false);
  const [ticketDraft, setTicketDraft] = useState<TicketDraft | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

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
  useEffect(() => {
    const current = stateRef.current.conversationId;
    if ((routeId ?? null) === current) return;
    setTicketDraft(null);
    setCreatedTicket(null);
    if (routeId) void loadHistory(routeId);
    else dispatch({ type: 'reset' });
  }, [routeId, loadHistory]);

  const send = useCallback(
    async (content: string) => {
      if (inFlight.current || !canSend(stateRef.current)) return;
      inFlight.current = true;
      dispatch({ type: 'sendStarted', content });
      setDraft('');
      setCreatedTicket(null);
      try {
        const response = await sendChatMessage({
          conversationId: stateRef.current.conversationId,
          content,
        });
        dispatch({ type: 'sendSucceeded', response });
        if (response.conversationId !== routeId) {
          navigate(`/chat/${response.conversationId}`, { replace: !routeId });
        }
        void refreshConversations();
      } catch (error) {
        dispatch({ type: 'sendFailed', error: toApiError(error) });
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

  const sending = state.status === 'sending';
  const empty =
    state.messages.length === 0 &&
    state.status !== 'loadingHistory' &&
    !state.pendingContent;

  return (
    <div className="chat-layout">
      <aside className="chat-sidebar" aria-label="Conversations">
        <Link to="/chat" className="button button--block">
          New chat
        </Link>
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

      <section className="chat-main" aria-labelledby="chat-title">
        <h1 id="chat-title" className="chat-main__title">
          Ask IT
        </h1>

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
                  onClick={() => setDraft(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className="message-log"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {state.messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              onCreateTicket={
                message.senderType === 'assistant'
                  ? () => {
                      setCreatedTicket(null);
                      setTicketDraft(draftFrom(state.messages, index));
                    }
                  : undefined
              }
            />
          ))}

          {state.pendingContent ? (
            <article
              className="message message--user message--pending"
              aria-label="You"
            >
              <p className="message__meta">
                You {sending ? '· sending' : '· not sent'}
              </p>
              <p className="message__body pre-line">{state.pendingContent}</p>
            </article>
          ) : null}

          {sending ? (
            <p className="message message--assistant typing" role="status">
              <span className="dots" aria-hidden="true">
                ● ● ●
              </span>{' '}
              Checking approved IT procedures…
            </p>
          ) : null}
        </div>

        {state.status === 'sendError' && state.error ? (
          <ErrorState
            message={
              state.error.kind === 'timeout'
                ? 'The assistant took too long to respond.'
                : state.error.message
            }
            onRetry={state.error.kind === 'validation' ? undefined : retry}
          >
            {state.error.kind !== 'validation' ? (
              <span className="muted small">Your message was not lost.</span>
            ) : null}
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                setTicketDraft({
                  title: (state.pendingContent ?? '').slice(0, 120),
                  description: `Reported in chat: ${state.pendingContent ?? ''}`,
                })
              }
            >
              Create a ticket instead
            </button>
          </ErrorState>
        ) : null}

        {ticketDraft ? (
          <CreateTicketForm
            initialTitle={ticketDraft.title}
            initialDescription={ticketDraft.description}
            onCancel={() => setTicketDraft(null)}
            onCreated={(ticket) => {
              setTicketDraft(null);
              setCreatedTicket(ticket);
            }}
          />
        ) : null}
        {createdTicket ? (
          <div className="alert alert--success" role="status">
            <p>
              <strong>Ticket {createdTicket.reference} created.</strong> Status:{' '}
              {createdTicket.status}. The IT team will follow up.
            </p>
          </div>
        ) : null}

        <Composer
          value={draft}
          onChange={setDraft}
          onSend={(content) => void send(content)}
          disabled={sending || state.status === 'loadingHistory'}
        />
      </section>
    </div>
  );
}
