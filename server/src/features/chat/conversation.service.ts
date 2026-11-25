import {
  badRequest,
  forbidden,
  HttpError,
  notFound,
} from '../../shared/http/errors.js';
import type { AuthContext } from '../auth/index.js';
import type { ChatAnswer } from './chat.service.js';
import type {
  ChatOutcome,
  ConversationRecord,
  ConversationRepository,
  MessageRecord,
  SourceRef,
} from './conversation.types.js';

export const MAX_MESSAGE_LENGTH = 2000;
export const DEFAULT_ANSWER_TIMEOUT_MS = 20_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Produces a grounded answer for a question (S2-06 answer orchestration). */
export type AnswerProvider = (
  question: string
) => ChatAnswer | Promise<ChatAnswer>;

export type AssignedTicketConversationLookup = {
  listConversationIdsForAgent(agentId: string): Promise<string[]>;
  isAssignedToAgent(conversationId: string, agentId: string): Promise<boolean>;
  isResolvedAndAssignedToAgent(
    conversationId: string,
    agentId: string
  ): Promise<boolean>;
};

export type SendMessageResult = {
  conversationId: string;
  conversation: ConversationRecord;
  userMessage: MessageRecord;
  message: MessageRecord;
  outcome: ChatOutcome;
};

export function validateMessageContent(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) {
    throw badRequest('Type a question first.');
  }
  const content = input.trim();
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw badRequest(
      `Keep messages under ${MAX_MESSAGE_LENGTH.toLocaleString('en-US')} characters.`
    );
  }
  return content;
}

/** Maps the answer service status to the outcome contract used by the UI. */
export function toChatOutcome(status: ChatAnswer['status']): ChatOutcome {
  return status === 'answered' ? 'answered' : 'escalation_suggested';
}

export function toSourceRefs(sources: ChatAnswer['sources']): SourceRef[] {
  return sources.map((source) => ({
    articleId: source.id,
    title: source.title,
    sourceName: source.sourceName,
    excerpt: source.excerpt,
    relevance: source.relevance,
  }));
}

export function conversationTitle(content: string): string {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  return singleLine.length > 80
    ? `${singleLine.slice(0, 77).trimEnd()}...`
    : singleLine;
}

export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new HttpError(
            504,
            'timeout',
            'The assistant took too long to respond. Please try again.'
          )
        ),
      timeoutMs
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly answer: AnswerProvider,
    private readonly timeoutMs = DEFAULT_ANSWER_TIMEOUT_MS,
    private readonly assignedTickets?: AssignedTicketConversationLookup
  ) {}

  async list(context: AuthContext): Promise<ConversationRecord[]> {
    if (context.role === 'employee') {
      return this.repository.listByRequester(context.userId);
    }
    if (context.role === 'agent' && this.assignedTickets) {
      const ids = await this.assignedTickets.listConversationIdsForAgent(
        context.userId
      );
      return this.repository.listByIds(ids);
    }
    throw forbidden('You do not have access to employee chats.');
  }

  async listArchived(context: AuthContext): Promise<ConversationRecord[]> {
    if (context.role !== 'employee') {
      throw forbidden('Only employees can view archived chats.');
    }
    return this.repository.listArchived(context.userId);
  }

  async rename(
    conversationId: string,
    title: unknown,
    context: AuthContext
  ): Promise<ConversationRecord> {
    this.requireEmployee(context);
    if (typeof title !== 'string') throw badRequest('Title must be a string.');
    const trimmed = title.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      throw badRequest('Title must contain between 1 and 120 characters.');
    }
    await this.requireOwned(conversationId, context);
    const updated = await this.repository.rename(conversationId, trimmed);
    if (!updated) throw notFound('Conversation not found.');
    return updated;
  }

  async setArchived(
    conversationId: string,
    archived: unknown,
    context: AuthContext
  ): Promise<ConversationRecord> {
    await this.requireEmployeeOrResolvedAgent(context, conversationId);
    if (typeof archived !== 'boolean') {
      throw badRequest('archived must be a boolean.');
    }
    await this.requireOwned(conversationId, context);
    const updated = await this.repository.archive(conversationId, archived);
    if (!updated) throw notFound('Conversation not found.');
    return updated;
  }

  async delete(conversationId: string, context: AuthContext): Promise<void> {
    await this.requireEmployeeOrResolvedAgent(context, conversationId);
    await this.requireOwned(conversationId, context);
    if (!(await this.repository.delete(conversationId))) {
      throw notFound('Conversation not found.');
    }
  }

  async getMessages(
    conversationId: string,
    context: AuthContext
  ): Promise<{ conversation: ConversationRecord; messages: MessageRecord[] }> {
    const conversation = await this.requireOwned(conversationId, context);
    const messages = await this.repository.listMessages(conversation.id);
    return { conversation, messages };
  }

  async markRead(conversationId: string, context: AuthContext): Promise<void> {
    await this.requireOwned(conversationId, context);
    if (context.role !== 'employee' && context.role !== 'agent') {
      throw forbidden('You do not have access to this conversation.');
    }
    if (!(await this.repository.markRead(conversationId, context.role))) {
      throw notFound('Conversation not found.');
    }
  }

  /**
   * Answers first, then persists the user/assistant pair together. A failed
   * or timed-out answer leaves no partial history, so the client can retry
   * the same text without creating duplicate user messages.
   */
  async send(input: unknown, context: AuthContext): Promise<SendMessageResult> {
    this.requireEmployee(context);
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw badRequest('Message request must be an object.');
    }
    const body = input as Record<string, unknown>;
    if (
      Object.keys(body).some(
        (key) => !['content', 'conversationId'].includes(key)
      )
    ) {
      throw badRequest('Message request contains an unexpected field.');
    }
    const content = validateMessageContent(body.content);

    if (
      body.conversationId !== undefined &&
      body.conversationId !== null &&
      (typeof body.conversationId !== 'string' ||
        !UUID_PATTERN.test(body.conversationId))
    ) {
      throw badRequest('conversationId must be a valid UUID.');
    }
    const existing = body.conversationId
      ? await this.requireOwned(body.conversationId as string, context)
      : null;

    let answer: ChatAnswer;
    try {
      answer = await withTimeout(
        Promise.resolve().then(() => this.answer(content)),
        this.timeoutMs
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Answer generation failed.');
      throw new HttpError(
        503,
        'answer_unavailable',
        "We couldn't get an answer right now. Please try again."
      );
    }

    const outcome = toChatOutcome(answer.status);
    const conversation =
      existing ??
      (await this.repository.create({
        requesterId: context.userId,
        title: conversationTitle(content),
      }));

    const [userMessage, message] = await this.repository.addMessages([
      {
        conversationId: conversation.id,
        senderType: 'user',
        content,
        outcome: null,
        sourceRefs: [],
      },
      {
        conversationId: conversation.id,
        senderType: 'assistant',
        content: answer.answer,
        outcome,
        sourceRefs: outcome === 'answered' ? toSourceRefs(answer.sources) : [],
      },
    ]);

    if (!userMessage || !message) {
      throw new HttpError(
        503,
        'service_unavailable',
        'The conversation could not be saved. Please try again.'
      );
    }

    return {
      conversationId: conversation.id,
      conversation,
      userMessage,
      message,
      outcome,
    };
  }

  /** Other users' conversations are reported as not found. */
  private async requireOwned(
    conversationId: string,
    context: AuthContext
  ): Promise<ConversationRecord> {
    if (!UUID_PATTERN.test(conversationId)) {
      throw notFound('Conversation not found.');
    }
    const conversation = await this.repository.findById(conversationId);
    const employeeOwns =
      context.role === 'employee' &&
      conversation?.requesterId === context.userId;
    const agentAssigned =
      context.role === 'agent' &&
      this.assignedTickets &&
      !conversation?.archivedAt &&
      (await this.assignedTickets.isAssignedToAgent(
        conversationId,
        context.userId
      ));
    if (
      !conversation ||
      conversation.deletedAt ||
      (!employeeOwns && !agentAssigned)
    ) {
      throw notFound('Conversation not found.');
    }
    return conversation;
  }

  private requireEmployee(context: AuthContext): void {
    if (context.role !== 'employee') {
      throw forbidden('Only employees can manage their chats.');
    }
  }

  private async requireEmployeeOrResolvedAgent(
    context: AuthContext,
    conversationId: string
  ): Promise<void> {
    if (context.role === 'employee') {
      await this.requireOwned(conversationId, context);
      return;
    }
    const conversation = await this.requireOwned(conversationId, context);
    if (
      context.role === 'agent' &&
      !conversation.archivedAt &&
      this.assignedTickets &&
      (await this.assignedTickets.isResolvedAndAssignedToAgent(
        conversationId,
        context.userId
      ))
    ) {
      return;
    }
    throw forbidden('Only resolved assigned chats can be archived or deleted.');
  }
}
