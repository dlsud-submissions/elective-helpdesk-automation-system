import { apiFetch, ApiError } from '../../../shared/api/http';
import {
  isChatOutcome,
  type ChatMessage,
  type Conversation,
  type SendMessageResponse,
} from '../types';

/** Answers can take a while; allow slightly more than the server timeout. */
export const SEND_TIMEOUT_MS = 25_000;

export async function sendChatMessage(input: {
  conversationId: string | null;
  content: string;
}): Promise<SendMessageResponse> {
  const response = await apiFetch<SendMessageResponse>('/api/chat/messages', {
    method: 'POST',
    body: {
      content: input.content,
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    },
    timeoutMs: SEND_TIMEOUT_MS,
  });

  // Never render a state the UI does not understand as success.
  if (
    !response ||
    !isChatOutcome(response.outcome) ||
    !response.message ||
    typeof response.message.content !== 'string' ||
    !Array.isArray(response.message.sourceRefs)
  ) {
    throw new ApiError(
      'server',
      "We couldn't read the assistant's reply. Please try again."
    );
  }
  return response;
}

export async function listConversations(): Promise<Conversation[]> {
  return (
    await apiFetch<{ conversations: Conversation[] }>('/api/conversations')
  ).conversations;
}

export function getConversationMessages(
  conversationId: string
): Promise<{ conversation: Conversation; messages: ChatMessage[] }> {
  return apiFetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`
  );
}

export async function listArchivedConversations(): Promise<Conversation[]> {
  return (
    await apiFetch<{ conversations: Conversation[] }>(
      '/api/conversations/archived'
    )
  ).conversations;
}

export async function renameConversation(
  conversationId: string,
  title: string
): Promise<Conversation> {
  return (
    await apiFetch<{ conversation: Conversation }>(
      `/api/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'PATCH', body: { title } }
    )
  ).conversation;
}

export async function setConversationArchived(
  conversationId: string,
  archived: boolean
): Promise<Conversation> {
  return (
    await apiFetch<{ conversation: Conversation }>(
      `/api/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'PATCH', body: { archived } }
    )
  ).conversation;
}

export function deleteConversation(conversationId: string): Promise<void> {
  return apiFetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  });
}
