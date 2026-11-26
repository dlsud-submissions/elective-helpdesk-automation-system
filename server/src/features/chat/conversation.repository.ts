import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  databaseError,
  getServiceClient,
} from '../../shared/database/index.js';
import type {
  ChatOutcome,
  ConversationRecord,
  ConversationRepository,
  MessageRecord,
  NewMessage,
  SenderType,
  SourceRef,
} from './conversation.types.js';

/** Process-local repository for tests and offline development only. */
export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<
    string,
    ConversationRecord & { unreadEmployee: boolean; unreadAgent: boolean }
  >();
  private readonly messages: MessageRecord[] = [];
  private clock = 0;

  private now(): string {
    this.clock = Math.max(Date.now(), this.clock + 1);
    return new Date(this.clock).toISOString();
  }

  async create(input: {
    requesterId: string;
    title: string;
  }): Promise<ConversationRecord> {
    const now = this.now();
    const conversation = {
      id: randomUUID(),
      requesterId: input.requesterId,
      title: input.title,
      archivedAt: null,
      deletedAt: null,
      isUnread: false,
      unreadEmployee: false,
      unreadAgent: false,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(conversation.id, conversation);
    return this.toRecord(conversation);
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    const conversation = this.conversations.get(id);
    return conversation ? this.toRecord(conversation) : null;
  }

  async listByRequester(requesterId: string): Promise<ConversationRecord[]> {
    return [...this.conversations.values()]
      .filter(
        (conversation) =>
          conversation.requesterId === requesterId &&
          !conversation.archivedAt &&
          !conversation.deletedAt
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((conversation) => this.toRecord(conversation, 'employee'));
  }

  async listByIds(conversationIds: string[]): Promise<ConversationRecord[]> {
    const ids = new Set(conversationIds);
    return [...this.conversations.values()]
      .filter(
        (conversation) =>
          ids.has(conversation.id) &&
          !conversation.archivedAt &&
          !conversation.deletedAt
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((conversation) => this.toRecord(conversation, 'agent'));
  }

  async listArchived(requesterId: string): Promise<ConversationRecord[]> {
    return [...this.conversations.values()]
      .filter(
        (conversation) =>
          conversation.requesterId === requesterId &&
          Boolean(conversation.archivedAt) &&
          !conversation.deletedAt
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((conversation) => this.toRecord(conversation, 'employee'));
  }

  async rename(id: string, title: string): Promise<ConversationRecord | null> {
    const conversation = this.conversations.get(id);
    if (!conversation || conversation.deletedAt) return null;
    conversation.title = title;
    return this.toRecord(conversation);
  }

  async archive(
    id: string,
    archived: boolean
  ): Promise<ConversationRecord | null> {
    const conversation = this.conversations.get(id);
    if (!conversation || conversation.deletedAt) return null;
    conversation.archivedAt = archived ? this.now() : null;
    return this.toRecord(conversation);
  }

  async markRead(id: string, reader: 'employee' | 'agent'): Promise<boolean> {
    const conversation = this.conversations.get(id);
    if (!conversation || conversation.deletedAt) return false;
    if (reader === 'employee') conversation.unreadEmployee = false;
    else conversation.unreadAgent = false;
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const conversation = this.conversations.get(id);
    if (!conversation) return false;
    conversation.deletedAt = this.now();
    return true;
  }

  async addMessages(messages: NewMessage[]): Promise<MessageRecord[]> {
    const saved = messages.map((message) => ({
      ...message,
      id: randomUUID(),
      createdAt: this.now(),
    }));
    this.messages.push(...saved);
    for (const message of saved) {
      const conversation = this.conversations.get(message.conversationId);
      if (conversation) {
        conversation.updatedAt = message.createdAt;
        if (message.senderType === 'user' || message.senderType === 'system') {
          conversation.unreadAgent = true;
        } else if (message.senderType === 'agent') {
          conversation.unreadEmployee = true;
        }
      }
    }
    return saved.map((message) => ({ ...message }));
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    return this.messages
      .filter((message) => message.conversationId === conversationId)
      .map((message) => ({ ...message }));
  }

  private toRecord(
    conversation: ConversationRecord & {
      unreadEmployee: boolean;
      unreadAgent: boolean;
    },
    reader?: 'employee' | 'agent'
  ): ConversationRecord {
    return {
      id: conversation.id,
      requesterId: conversation.requesterId,
      title: conversation.title,
      archivedAt: conversation.archivedAt,
      deletedAt: conversation.deletedAt,
      isUnread:
        reader === 'employee'
          ? conversation.unreadEmployee
          : reader === 'agent'
            ? conversation.unreadAgent
            : false,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}

type ConversationRow = {
  id: string;
  requester_id: string;
  title: string;
  archived_at: string | null;
  deleted_at: string | null;
  unread_employee: boolean;
  unread_agent: boolean;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  content: string;
  outcome: ChatOutcome | null;
  source_refs: SourceRef[] | null;
  created_at: string;
};

const toConversation = (
  row: ConversationRow,
  reader?: 'employee' | 'agent'
): ConversationRecord => ({
  id: row.id,
  requesterId: row.requester_id,
  title: row.title,
  archivedAt: row.archived_at,
  deletedAt: row.deleted_at,
  isUnread:
    reader === 'employee'
      ? row.unread_employee
      : reader === 'agent'
        ? row.unread_agent
        : false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toMessage = (row: MessageRow): MessageRecord => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderType: row.sender_type,
  content: row.content,
  outcome: row.outcome,
  sourceRefs: Array.isArray(row.source_refs) ? row.source_refs : [],
  createdAt: row.created_at,
});

const conversationColumns =
  'id, requester_id, title, archived_at, deleted_at, unread_employee, unread_agent, created_at, updated_at';
const messageColumns =
  'id, conversation_id, sender_type, content, outcome, source_refs, created_at';

/** Service-role repository; callers must check conversation ownership first. */
export class SupabaseConversationRepository implements ConversationRepository {
  constructor(
    private readonly client: () => SupabaseClient = getServiceClient
  ) {}

  async create(input: {
    requesterId: string;
    title: string;
  }): Promise<ConversationRecord> {
    const { data, error } = await this.client()
      .from('conversations')
      .insert({ requester_id: input.requesterId, title: input.title })
      .select(conversationColumns)
      .single<ConversationRow>();
    if (error || !data) throw databaseError(error, 'conversation create');
    return toConversation(data);
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    const { data, error } = await this.client()
      .from('conversations')
      .select(conversationColumns)
      .eq('id', id)
      .maybeSingle<ConversationRow>();
    if (error) throw databaseError(error, 'conversation read');
    return data ? toConversation(data) : null;
  }

  async listByRequester(requesterId: string): Promise<ConversationRecord[]> {
    const { data, error } = await this.client()
      .from('conversations')
      .select(conversationColumns)
      .eq('requester_id', requesterId)
      .is('archived_at', null)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(50)
      .returns<ConversationRow[]>();
    if (error) throw databaseError(error, 'conversation list');
    return (data ?? []).map((row) => toConversation(row, 'employee'));
  }

  async listByIds(conversationIds: string[]): Promise<ConversationRecord[]> {
    if (!conversationIds.length) return [];
    const { data, error } = await this.client()
      .from('conversations')
      .select(conversationColumns)
      .in('id', conversationIds)
      .is('archived_at', null)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(50)
      .returns<ConversationRow[]>();
    if (error) throw databaseError(error, 'assigned conversation list');
    return (data ?? []).map((row) => toConversation(row, 'agent'));
  }

  async listArchived(requesterId: string): Promise<ConversationRecord[]> {
    const { data, error } = await this.client()
      .from('conversations')
      .select(conversationColumns)
      .eq('requester_id', requesterId)
      .not('archived_at', 'is', null)
      .is('deleted_at', null)
      .order('archived_at', { ascending: false })
      .limit(50)
      .returns<ConversationRow[]>();
    if (error) throw databaseError(error, 'archived conversation list');
    return (data ?? []).map((row) => toConversation(row, 'employee'));
  }

  async rename(id: string, title: string): Promise<ConversationRecord | null> {
    const { data, error } = await this.client()
      .from('conversations')
      .update({ title })
      .eq('id', id)
      .is('deleted_at', null)
      .select(conversationColumns)
      .maybeSingle<ConversationRow>();
    if (error) throw databaseError(error, 'conversation rename');
    return data ? toConversation(data) : null;
  }

  async archive(
    id: string,
    archived: boolean
  ): Promise<ConversationRecord | null> {
    const { data, error } = await this.client()
      .from('conversations')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id)
      .is('deleted_at', null)
      .select(conversationColumns)
      .maybeSingle<ConversationRow>();
    if (error) throw databaseError(error, 'conversation archive');
    return data ? toConversation(data) : null;
  }

  async markRead(id: string, reader: 'employee' | 'agent'): Promise<boolean> {
    const field = reader === 'employee' ? 'unread_employee' : 'unread_agent';
    const { data, error } = await this.client()
      .from('conversations')
      .update({ [field]: false })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle<{ id: string }>();
    if (error) throw databaseError(error, 'conversation mark read');
    return Boolean(data);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.client()
      .from('conversations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);
    if (error) throw databaseError(error, 'conversation delete');
    return true;
  }

  async addMessages(messages: NewMessage[]): Promise<MessageRecord[]> {
    if (!messages.length) return [];
    // Explicit, strictly increasing timestamps keep the user/assistant pair in
    // order even though both rows are inserted in one statement.
    const base = Date.now();
    const { data, error } = await this.client()
      .from('messages')
      .insert(
        messages.map((message, index) => ({
          conversation_id: message.conversationId,
          sender_type: message.senderType,
          content: message.content,
          outcome: message.outcome,
          source_refs: message.sourceRefs,
          created_at: new Date(base + index).toISOString(),
        }))
      )
      .select(messageColumns)
      .returns<MessageRow[]>();
    if (error) throw databaseError(error, 'message create');

    const conversationId = messages[0]!.conversationId;
    const touch = await this.client()
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    // The messages are already stored. Failing here would make the client
    // retry and duplicate them, so a stale sort timestamp is only logged.
    if (touch.error) {
      console.error('Conversation timestamp update failed.');
    }

    return (data ?? [])
      .map(toMessage)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    const { data, error } = await this.client()
      .from('messages')
      .select(messageColumns)
      .eq('conversation_id', conversationId)
      .order('created_at')
      .limit(500)
      .returns<MessageRow[]>();
    if (error) throw databaseError(error, 'message list');
    return (data ?? []).map(toMessage);
  }
}
