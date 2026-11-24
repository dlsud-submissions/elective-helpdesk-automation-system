export type SenderType = 'user' | 'assistant' | 'agent' | 'system';

/** Outcome values the client must handle; anything else is treated as an error. */
export type ChatOutcome =
  | 'answered'
  | 'clarification'
  | 'escalation_suggested'
  | 'ticket_created'
  | 'escalated';

export type SourceRef = {
  articleId: string;
  title: string;
  sourceName: string;
  excerpt: string;
  relevance: number;
};

export type ConversationRecord = {
  id: string;
  requesterId: string;
  title: string;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  senderType: SenderType;
  content: string;
  outcome: ChatOutcome | null;
  sourceRefs: SourceRef[];
  createdAt: string;
};

export type NewMessage = Omit<MessageRecord, 'id' | 'createdAt'>;

export interface ConversationRepository {
  create(input: {
    requesterId: string;
    title: string;
  }): Promise<ConversationRecord>;
  findById(id: string): Promise<ConversationRecord | null>;
  listByRequester(requesterId: string): Promise<ConversationRecord[]>;
  listByIds(conversationIds: string[]): Promise<ConversationRecord[]>;
  listArchived(requesterId: string): Promise<ConversationRecord[]>;
  rename(id: string, title: string): Promise<ConversationRecord | null>;
  archive(id: string, archived: boolean): Promise<ConversationRecord | null>;
  delete(id: string): Promise<boolean>;
  /** Persists messages in order and bumps the conversation's updatedAt. */
  addMessages(messages: NewMessage[]): Promise<MessageRecord[]>;
  listMessages(conversationId: string): Promise<MessageRecord[]>;
}
