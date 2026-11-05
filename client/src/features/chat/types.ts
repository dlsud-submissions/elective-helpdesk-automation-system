/** Mirrors the server chat contract (docs/sprints/sprint-3/api-contracts.md). */
export const chatOutcomes = [
  'answered',
  'clarification',
  'escalation_suggested',
  'ticket_created',
  'escalated',
] as const;

export type ChatOutcome = (typeof chatOutcomes)[number];

export const isChatOutcome = (value: unknown): value is ChatOutcome =>
  typeof value === 'string' &&
  (chatOutcomes as readonly string[]).includes(value);

export type SourceRef = {
  articleId: string;
  title: string;
  sourceName: string;
  excerpt: string;
  relevance: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderType: 'user' | 'assistant' | 'system';
  content: string;
  outcome: ChatOutcome | null;
  sourceRefs: SourceRef[];
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type SendMessageResponse = {
  conversationId: string;
  conversation: Conversation;
  userMessage: ChatMessage;
  message: ChatMessage;
  outcome: ChatOutcome;
};

export const MAX_MESSAGE_LENGTH = 2000;
