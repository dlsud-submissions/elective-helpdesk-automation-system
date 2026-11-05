import { badRequest, HttpError, notFound } from '../../shared/http/errors.js';
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

/** Produces a grounded answer for a question (S2-06 answer orchestration). */
export type AnswerProvider = (
  question: string
) => ChatAnswer | Promise<ChatAnswer>;

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
    private readonly timeoutMs = DEFAULT_ANSWER_TIMEOUT_MS
  ) {}

  async list(context: AuthContext): Promise<ConversationRecord[]> {
    return this.repository.listByRequester(context.userId);
  }

  async getMessages(
    conversationId: string,
    context: AuthContext
  ): Promise<{ conversation: ConversationRecord; messages: MessageRecord[] }> {
    const conversation = await this.requireOwned(conversationId, context);
    const messages = await this.repository.listMessages(conversation.id);
    return { conversation, messages };
  }

  /**
   * Answers first, then persists the user/assistant pair together. A failed
   * or timed-out answer leaves no partial history, so the client can retry
   * the same text without creating duplicate user messages.
   */
  async send(input: unknown, context: AuthContext): Promise<SendMessageResult> {
    const body = (input ?? {}) as Record<string, unknown>;
    const content = validateMessageContent(body.content);

    if (
      body.conversationId !== undefined &&
      body.conversationId !== null &&
      typeof body.conversationId !== 'string'
    ) {
      throw badRequest('conversationId must be a string.');
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
      console.error('Answer generation failed:', error);
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
    const conversation = await this.repository.findById(conversationId);
    if (!conversation || conversation.requesterId !== context.userId) {
      throw notFound('Conversation not found.');
    }
    return conversation;
  }
}
