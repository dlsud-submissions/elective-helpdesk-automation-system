import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isRetryable, toApiError } from '../../../shared/api/http';
import { ErrorState, LoadingState } from '../../../shared/ui/StatusViews';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';
import { useProfile } from '../../auth';
import {
  CreateTicketForm,
  listTickets,
  updateTicket,
  type Ticket,
} from '../../tickets';
import {
  generateTicketSolution,
  saveTicketSolutionDraft,
  sendTicketReply,
} from '../../tickets/api/tickets.api';
import { submitKbPair } from '../../knowledge/api/kb-submissions.api';
import {
  deleteConversation,
  getConversationMessages,
  listConversations,
  renameConversation,
  sendChatMessage,
  setConversationArchived,
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

/** Remount the follow-up form with fresh text each time it opens. */
type Panel = { kind: 'ticket'; key: number; draft: TicketDraft };

type Outcome = { kind: 'ticket'; ticket: Ticket };

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
    return 'Assistant replied: no approved procedure was found. You can create a ticket for the IT team.';
  }
  const count = message.sourceRefs.length;
  return `Assistant replied${count ? ` with ${count} source${count === 1 ? '' : 's'}` : ''}.`;
}

export function ChatPage() {
  useDocumentTitle('Chat');
  const profile = useProfile();
  const isAgent = profile.role === 'agent';
  const canCreateTicket = profile.role === 'employee';
  const { conversationId: routeId } = useParams();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [draft, setDraft] = useState('');
  const [conversations, setConversations] = useState<Conversation[] | null>(
    null
  );
  const [assignedTickets, setAssignedTickets] = useState<Ticket[]>([]);
  const [ticketUpdateError, setTicketUpdateError] = useState('');
  const [updatingTicket, setUpdatingTicket] = useState(false);
  const [conversationsError, setConversationsError] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const [conversationActionError, setConversationActionError] = useState('');
  // A persistent live region: it exists before its text changes, so screen
  // readers announce updates reliably.
  const [announcement, setAnnouncement] = useState('');

  // Agent solution panel state
  const [agentReply, setAgentReply] = useState('');
  const [agentReplyState, setAgentReplyState] = useState<
    'idle' | 'sending' | 'sent' | 'failed'
  >('idle');
  const [agentReplyError, setAgentReplyError] = useState('');
  const [generatingSolution, setGeneratingSolution] = useState(false);
  const [generatedModel, setGeneratedModel] = useState('');
  const [savingSolution, setSavingSolution] = useState(false);
  const [solutionSaved, setSolutionSaved] = useState(false);
  const [solutionActionError, setSolutionActionError] = useState('');
  const [kbSaveState, setKbSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'failed'
  >('idle');
  const [kbSaveError, setKbSaveError] = useState('');
  const solutionInputId = useId();

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
      const [nextConversations, tickets] = await Promise.all([
        listConversations(),
        isAgent ? listTickets() : Promise.resolve([]),
      ]);
      setConversations(nextConversations);
      if (isAgent) setAssignedTickets(tickets);
      setConversationsError(false);
    } catch {
      setConversationsError(true);
    }
  }, [isAgent]);

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
    // Reset agent reply panel on conversation switch
    setAgentReply('');
    setAgentReplyState('idle');
    setAgentReplyError('');
    setGeneratedModel('');
    setSolutionSaved(false);
    setSolutionActionError('');
    setKbSaveState('idle');
    setKbSaveError('');
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

  const performConversationAction = async (
    conversationId: string,
    action: () => Promise<unknown>,
    leaveChat = false
  ) => {
    setOpenActionsFor(null);
    setConversationActionError('');
    try {
      await action();
      await refreshConversations();
      if (leaveChat && conversationId === routeId) navigate('/chat');
    } catch (error) {
      setConversationActionError(toApiError(error).message);
    }
  };

  const sending = state.status === 'sending';
  const empty =
    state.messages.length === 0 &&
    state.status !== 'loadingHistory' &&
    !state.pendingContent;
  const sendErrorText = state.pendingContent ?? '';
  const currentTicket = isAgent
    ? assignedTickets.find((ticket) => ticket.conversationId === routeId)
    : undefined;

  /**
   * Derive the agent display name for rendering 'agent' message bubbles.
   * - Agents: always their own profile name (they only see their own replies).
   * - Employees: extracted from the system message "Ticket TCK-XXXX assigned
   *   to <Name>." that the server injects when a ticket is created.
   */
  const agentDisplayName: string = (() => {
    if (isAgent) return profile.displayName;
    const systemMsg = state.messages.find((m) => m.senderType === 'system');
    if (systemMsg) {
      const match = /assigned to ([^.]+)\./.exec(systemMsg.content);
      if (match?.[1]) return match[1].trim();
    }
    return 'IT agent';
  })();
  const currentTicketResolved =
    currentTicket?.status === 'resolved' || currentTicket?.status === 'closed';

  const resolveCurrentTicket = async () => {
    if (!currentTicket || updatingTicket || currentTicketResolved) return;
    setUpdatingTicket(true);
    setTicketUpdateError('');
    try {
      const updated = await updateTicket(currentTicket.id, {
        status: 'resolved',
        expectedUpdatedAt: currentTicket.updatedAt,
      });
      setAssignedTickets((tickets) =>
        tickets.map((ticket) => (ticket.id === updated.id ? updated : ticket))
      );
    } catch (error) {
      setTicketUpdateError(toApiError(error).message);
    } finally {
      setUpdatingTicket(false);
    }
  };

  const generateSolution = async () => {
    if (generatingSolution || !currentTicket) return;
    if (
      agentReply.trim() &&
      !window.confirm('Replace the current solution draft with a Gemini draft?')
    ) {
      return;
    }
    setGeneratingSolution(true);
    setSolutionActionError('');
    try {
      const generated = await generateTicketSolution(currentTicket.id);
      setGeneratedModel(generated.model);
      setAgentReply(generated.content);
      setAgentReplyState('idle');
      setAgentReplyError('');
      setSolutionSaved(false);
    } catch (error) {
      setSolutionActionError(toApiError(error).message);
    } finally {
      setGeneratingSolution(false);
    }
  };

  const sendAgentReply = async () => {
    if (!agentReply.trim() || agentReplyState === 'sending' || !currentTicket)
      return;
    setAgentReplyState('sending');
    setAgentReplyError('');
    try {
      await sendTicketReply(currentTicket.id, agentReply.trim());
      setAgentReply('');
      setAgentReplyState('sent');
      setSolutionSaved(false);
      // Reload messages so the new agent message appears in the chat
      if (routeId) void loadHistory(routeId);
    } catch (error) {
      setAgentReplyError(toApiError(error).message);
      setAgentReplyState('failed');
    }
  };

  const saveSolutionDraft = async () => {
    if (!currentTicket || !agentReply.trim() || savingSolution) return;
    setSavingSolution(true);
    setSolutionActionError('');
    try {
      await saveTicketSolutionDraft(currentTicket.id, agentReply.trim());
      setSolutionSaved(true);
    } catch (error) {
      setSolutionActionError(toApiError(error).message);
    } finally {
      setSavingSolution(false);
    }
  };

  const saveToKb = async () => {
    if (!agentReply.trim() || !currentTicket || kbSaveState === 'saving')
      return;
    setKbSaveState('saving');
    setKbSaveError('');
    try {
      // Use the ticket description as the "input" (employee problem)
      const problemText =
        currentTicket.escalationSummary ?? currentTicket.description;
      await submitKbPair({
        input: problemText,
        solution: agentReply.trim(),
        ticketId: currentTicket.id,
        ticketReference: currentTicket.reference,
      });
      setKbSaveState('saved');
    } catch (error) {
      setKbSaveError(toApiError(error).message);
      setKbSaveState('failed');
    }
  };

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
            {isAgent ? null : (
              <Link to="/chat" className="button button--secondary">
                Start a new chat
              </Link>
            )}
          </ErrorState>
        ) : null}
        {empty && state.status !== 'historyError' && isAgent ? (
          <div className="chat-empty">
            <h2>Assigned customer chats</h2>
            <p className="muted">
              Choose a conversation linked to a ticket assigned to you.
            </p>
          </div>
        ) : null}
        {empty && state.status !== 'historyError' && !isAgent ? (
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
        {isAgent && currentTicket ? (
          <section className="panel" aria-labelledby="assigned-ticket-title">
            <p className="muted small">
              {currentTicket.reference} · {currentTicket.priority} priority ·{' '}
              {currentTicket.status.replace('_', ' ')}
            </p>
            <h2 id="assigned-ticket-title">{currentTicket.title}</h2>
            <p className="pre-line">
              {currentTicket.escalationSummary ?? currentTicket.description}
            </p>
            {ticketUpdateError ? (
              <p className="alert alert--error" role="alert">
                {ticketUpdateError}
              </p>
            ) : null}
            {currentTicketResolved ? (
              <p className="alert alert--success" role="status">
                Ticket resolved.
              </p>
            ) : (
              <button
                type="button"
                className="button"
                aria-disabled={updatingTicket}
                onClick={() => void resolveCurrentTicket()}
              >
                {updatingTicket ? 'Resolving…' : 'Mark ticket as resolved'}
              </button>
            )}
          </section>
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
                isAgentView={isAgent}
                agentDisplayName={agentDisplayName}
                onCreateTicket={
                  message.senderType === 'assistant' && canCreateTicket
                    ? () =>
                        openPanel({
                          kind: 'ticket',
                          draft: ticketDraftFrom(state.messages, index),
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
            {canCreateTicket ? (
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
            ) : null}
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
        {outcome ? (
          <div
            className="alert alert--success"
            role="status"
            ref={outcomeRef}
            tabIndex={-1}
          >
            <p>
              <strong>Ticket {outcome.ticket.reference} created.</strong>{' '}
              Status: {outcome.ticket.status}. An admin can assign it to an
              agent, whose replies will appear in this chat.
            </p>
            <p>
              <Link to="/tickets">View my tickets</Link>
            </p>
          </div>
        ) : null}

        {isAgent && currentTicket ? (
          <section
            className="agent-reply-panel"
            aria-labelledby="agent-reply-title"
          >
            <h3 id="agent-reply-title">Reply to requester</h3>
            <div className="field">
              <label htmlFor={solutionInputId}>Message</label>
              <textarea
                id={solutionInputId}
                value={agentReply}
                onChange={(event) => {
                  setAgentReply(event.target.value);
                  if (agentReplyState !== 'idle') setAgentReplyState('idle');
                  setSolutionSaved(false);
                  if (kbSaveState !== 'idle') setKbSaveState('idle');
                }}
                rows={5}
                maxLength={8000}
                placeholder="Type a message to the requester…"
                disabled={agentReplyState === 'sending'}
              />
            </div>

            {/* Controls row below the textarea */}
            <div className="agent-reply-panel__controls">
              <button
                type="button"
                className="button button--icon"
                onClick={() => void generateSolution()}
                disabled={generatingSolution || agentReplyState === 'sending'}
                title={
                  generatingSolution ? 'Generating…' : 'Generate with Gemini'
                }
                aria-label={
                  generatingSolution
                    ? 'Generating with Gemini…'
                    : 'Generate with Gemini'
                }
              >
                {generatingSolution ? (
                  <span className="dots" aria-hidden="true">
                    ●
                  </span>
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
                    <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="button button--secondary"
                disabled={
                  savingSolution ||
                  agentReplyState === 'sending' ||
                  !agentReply.trim()
                }
                onClick={() => void saveSolutionDraft()}
              >
                {savingSolution
                  ? 'Saving draft…'
                  : solutionSaved
                    ? 'Draft saved'
                    : 'Save draft'}
              </button>

              <button
                type="button"
                className="button button--secondary"
                disabled={kbSaveState === 'saving' || !agentReply.trim()}
                onClick={() => void saveToKb()}
                title="Submit for admin review to add to the knowledge base"
              >
                {kbSaveState === 'saving'
                  ? 'Submitting…'
                  : kbSaveState === 'saved'
                    ? 'Submitted ✓'
                    : 'Save response to database'}
              </button>

              <button
                type="button"
                className="button"
                disabled={agentReplyState === 'sending' || !agentReply.trim()}
                onClick={() => void sendAgentReply()}
              >
                {agentReplyState === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>

            {generatedModel ? (
              <p className="muted small">
                Gemini draft ({generatedModel}) · review before sending.
              </p>
            ) : null}

            {solutionActionError ? (
              <p className="alert alert--error" role="alert">
                {solutionActionError}
              </p>
            ) : null}
            {agentReplyError ? (
              <p className="alert alert--error" role="alert">
                {agentReplyError}
              </p>
            ) : null}
            {kbSaveError ? (
              <p className="alert alert--error" role="alert">
                {kbSaveError}
              </p>
            ) : null}
            {agentReplyState === 'sent' ? (
              <p className="alert alert--success" role="status">
                Message sent.
              </p>
            ) : null}
            {kbSaveState === 'saved' ? (
              <p className="alert alert--success" role="status">
                Response submitted for admin review.
              </p>
            ) : null}
          </section>
        ) : null}

        {isAgent ? null : (
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={(content) => void send(content)}
            sending={sending}
            disabled={state.status === 'loadingHistory'}
            inputRef={composerRef}
          />
        )}
      </section>

      {/* After the chat in the DOM so keyboard and screen-reader order match
          the narrow layout; CSS places it on the left on wide screens. */}
      <aside
        className="chat-sidebar"
        aria-label={isAgent ? 'Assigned customer chats' : 'Conversations'}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && openActionsFor) {
            setOpenActionsFor(null);
            document
              .getElementById(`chat-actions-trigger-${openActionsFor}`)
              ?.focus();
          }
        }}
      >
        {isAgent ? null : (
          <Link to="/chat" className="button button--block">
            New chat
          </Link>
        )}
        {conversationActionError ? (
          <p className="alert alert--error" role="alert">
            {conversationActionError}
          </p>
        ) : null}
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
              <li key={conversation.id} className="conversation-item">
                <div className="conversation-item__row">
                  <Link
                    to={`/chat/${conversation.id}`}
                    title={conversation.title}
                    aria-current={
                      conversation.id === routeId ? 'page' : undefined
                    }
                  >
                    {conversation.title}
                  </Link>
                  {isAgent &&
                  !assignedTickets.some(
                    (ticket) =>
                      ticket.conversationId === conversation.id &&
                      (ticket.status === 'resolved' ||
                        ticket.status === 'closed')
                  ) ? null : (
                    <button
                      type="button"
                      id={`chat-actions-trigger-${conversation.id}`}
                      className="conversation-actions__trigger"
                      aria-label={`Chat actions for ${conversation.title}`}
                      aria-expanded={openActionsFor === conversation.id}
                      aria-controls={`chat-actions-${conversation.id}`}
                      onClick={() =>
                        setOpenActionsFor((current) =>
                          current === conversation.id ? null : conversation.id
                        )
                      }
                    >
                      <span aria-hidden="true">⋯</span>
                    </button>
                  )}
                </div>
                {!isAgent && openActionsFor === conversation.id ? (
                  <div
                    className="conversation-actions"
                    id={`chat-actions-${conversation.id}`}
                    aria-label={`Actions for ${conversation.title}`}
                  >
                    <button
                      type="button"
                      className="link-button small"
                      onClick={() => {
                        const title = window.prompt(
                          'Chat name',
                          conversation.title
                        );
                        if (!title?.trim()) {
                          setOpenActionsFor(null);
                          return;
                        }
                        void performConversationAction(conversation.id, () =>
                          renameConversation(conversation.id, title.trim())
                        );
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="link-button small"
                      onClick={() =>
                        void performConversationAction(
                          conversation.id,
                          () => setConversationArchived(conversation.id, true),
                          true
                        )
                      }
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      className="link-button small"
                      onClick={() => {
                        if (
                          !window.confirm(`Delete "${conversation.title}"?`)
                        ) {
                          setOpenActionsFor(null);
                          return;
                        }
                        void performConversationAction(
                          conversation.id,
                          () => deleteConversation(conversation.id),
                          true
                        );
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
                {isAgent &&
                openActionsFor === conversation.id &&
                assignedTickets.some(
                  (ticket) =>
                    ticket.conversationId === conversation.id &&
                    (ticket.status === 'resolved' || ticket.status === 'closed')
                ) ? (
                  <div
                    className="conversation-actions"
                    id={`chat-actions-${conversation.id}`}
                    aria-label={`Actions for ${conversation.title}`}
                  >
                    <button
                      type="button"
                      className="link-button small"
                      onClick={() =>
                        void performConversationAction(
                          conversation.id,
                          () => setConversationArchived(conversation.id, true),
                          true
                        )
                      }
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      className="link-button small"
                      onClick={() => {
                        if (
                          !window.confirm(`Delete "${conversation.title}"?`)
                        ) {
                          setOpenActionsFor(null);
                          return;
                        }
                        void performConversationAction(
                          conversation.id,
                          () => deleteConversation(conversation.id),
                          true
                        );
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {conversations && conversations.length === 0 ? (
          <p className="muted small">
            {isAgent
              ? 'No conversations are linked to your assigned tickets.'
              : 'No past conversations yet.'}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
