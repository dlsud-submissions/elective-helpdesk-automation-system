import { randomUUID } from 'node:crypto';
import {
  badRequest,
  forbidden,
  HttpError,
  notFound,
} from '../../shared/http/errors.js';
import { isUuid } from '../../shared/validation/uuid.js';
import type {
  AuditLogEntry,
  NewTicket,
  RequestContext,
  TicketMutation,
  TicketPatch,
  TicketPriority,
  TicketProfileLookup,
  TicketRecord,
  TicketRepository,
  TicketSolutionDraftRecord,
  TicketSolutionGenerator,
  TicketStatus,
  ValidatedTicketRequest,
} from './tickets.types.js';

export const allowedStatuses: TicketStatus[] = [
  'pending',
  'in_progress',
  'resolved',
];

export const validTransitions: Record<TicketStatus, TicketStatus[]> = {
  pending: ['in_progress', 'resolved'],
  in_progress: ['pending', 'resolved'],
  resolved: ['pending', 'in_progress'],
};

const isStaff = (context: RequestContext) =>
  context.role === 'agent' || context.role === 'admin';

export function normalizePriority(priority: unknown): TicketPriority {
  if (priority === undefined || priority === null) return 'medium';
  const value = typeof priority === 'string' ? priority.toLowerCase() : '';

  if (
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'urgent'
  ) {
    return value;
  }

  throw badRequest(
    'Ticket priority must be one of low, medium, high, or urgent.'
  );
}

export function validateTicketRequest(input: unknown): ValidatedTicketRequest {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Ticket request must be an object.');
  }
  const body = input as Record<string, unknown>;
  const allowedFields = new Set([
    'title',
    'description',
    'category',
    'priority',
    'requesterId',
    'requesterName',
  ]);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw badRequest('Ticket request contains an unexpected field.');
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description =
    typeof body.description === 'string' ? body.description.trim() : '';

  if (!title) throw badRequest('Ticket title is required.');
  if (title.length > 120) {
    throw badRequest('Ticket title must be 120 characters or fewer.');
  }
  if (!description) throw badRequest('Ticket description is required.');
  if (description.length > 5000) {
    throw badRequest('Ticket description must be 5000 characters or fewer.');
  }
  if (body.category !== undefined && typeof body.category !== 'string') {
    throw badRequest('Ticket category must be a string when provided.');
  }
  const category =
    (typeof body.category === 'string' && body.category.trim()) || 'general';
  if (category.length > 60) {
    throw badRequest('Ticket category must be 60 characters or fewer.');
  }

  return {
    title,
    description,
    category,
    priority: normalizePriority(body.priority),
  };
}

export function normalizeStatus(status: unknown): TicketStatus {
  const value =
    typeof status === 'string' ? (status.toLowerCase() as TicketStatus) : '';
  if (!allowedStatuses.includes(value as TicketStatus)) {
    throw badRequest(
      `Ticket status must be one of ${allowedStatuses.join(', ')}.`
    );
  }
  return value as TicketStatus;
}

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (from !== to && !validTransitions[from].includes(to)) {
    throw badRequest(`Status transition from ${from} to ${to} is not allowed.`);
  }
}

/** Resolves who owns a chat conversation, so tickets can link to it. */
export type ConversationOwnerLookup = {
  findById(id: string): Promise<{ requesterId: string } | null>;
  addMessages(
    messages: Array<{
      conversationId: string;
      senderType: 'agent' | 'system';
      content: string;
      outcome: null;
      sourceRefs: never[];
    }>
  ): Promise<unknown[]>;
};

export class TicketService {
  constructor(
    private readonly repository: TicketRepository,
    private readonly profiles: TicketProfileLookup,
    private readonly conversations?: ConversationOwnerLookup,
    private readonly solutionGenerator?: TicketSolutionGenerator
  ) {}

  /**
   * Splits an optional conversationId off the request body. A ticket may only
   * link to a conversation the requester owns; anything else is a 400 so
   * conversation IDs cannot be probed or attached to someone else's ticket.
   */
  private async takeConversationId(
    input: unknown,
    context: RequestContext
  ): Promise<{ body: unknown; conversationId?: string }> {
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input) ||
      !('conversationId' in input)
    ) {
      return { body: input };
    }
    const { conversationId, ...body } = input as Record<string, unknown>;
    if (conversationId === undefined || conversationId === null) {
      return { body };
    }
    if (!isUuid(conversationId)) {
      throw badRequest('conversationId must be a valid UUID.');
    }
    const conversation = await this.conversations?.findById(conversationId);
    if (!conversation || conversation.requesterId !== context.userId) {
      throw badRequest('conversationId does not match one of your chats.');
    }
    return { body, conversationId };
  }

  /** Requester identity always comes from the verified auth context. */
  async create(
    input: unknown,
    context: RequestContext,
    extras: Pick<
      NewTicket,
      'isEscalated' | 'conversationId' | 'escalationSummary'
    > = {},
    idempotencyKey: string = randomUUID()
  ): Promise<TicketRecord> {
    if (context.role !== 'employee') {
      throw forbidden('Only employees can create tickets.');
    }
    const { body, conversationId } = await this.takeConversationId(
      input,
      context
    );
    const result = await this.repository.create({
      ...validateTicketRequest(body),
      ...(conversationId ? { conversationId } : {}),
      ...extras,
      requesterId: context.userId,
      idempotencyKey,
    });
    if (result.created) {
      await this.repository.recordAudit({
        ticketId: result.ticket.id,
        action: 'ticket.created',
        actorId: context.userId,
        outcome: 'success',
        summary: `Ticket ${result.ticket.reference} created.`,
      });
    }
    return result.ticket;
  }

  /** Employees see requests they created; agents see assigned work; admins see all. */
  async list(context: RequestContext): Promise<TicketRecord[]> {
    if (context.role === 'admin') return this.repository.list({});
    return this.repository.list(
      context.role === 'agent'
        ? { assignedTo: context.userId }
        : { requesterId: context.userId }
    );
  }

  async get(
    ticketId: string,
    context: RequestContext
  ): Promise<{ ticket: TicketRecord; audit: AuditLogEntry[] }> {
    // A malformed ID can never match, and must not reach the database (where
    // it would surface as a misleading 503).
    if (!isUuid(ticketId)) throw notFound('Ticket not found.');
    const ticket = await this.repository.findById(ticketId);
    // Return 404 rather than 403 so ticket IDs cannot be probed.
    if (
      !ticket ||
      (context.role === 'employee' && ticket.requesterId !== context.userId) ||
      (context.role === 'agent' && ticket.assignedTo !== context.userId)
    ) {
      throw notFound('Ticket not found.');
    }
    const audit = isStaff(context)
      ? await this.repository.listAudit(ticket.id)
      : [];
    return { ticket, audit };
  }

  async reply(
    ticketId: string,
    input: unknown,
    context: RequestContext
  ): Promise<unknown> {
    if (!isStaff(context)) {
      throw forbidden("You don't have permission to reply to this ticket.");
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw badRequest('Reply request must be an object.');
    }
    const body = input as Record<string, unknown>;
    if (Object.keys(body).some((field) => field !== 'content')) {
      throw badRequest('Reply request contains an unexpected field.');
    }
    if (typeof body.content !== 'string') {
      throw badRequest('Reply content must be a string.');
    }
    const content = body.content.trim();
    if (content.length < 1 || content.length > 8000) {
      throw badRequest(
        'Reply content must contain between 1 and 8000 characters.'
      );
    }
    if (!isUuid(ticketId)) throw notFound('Ticket not found.');

    const ticket = await this.repository.findById(ticketId);
    if (!ticket) throw notFound('Ticket not found.');
    if (context.role !== 'admin' && ticket.assignedTo !== context.userId) {
      throw forbidden('This ticket is not assigned to you.');
    }
    if (!ticket.conversationId) {
      throw badRequest('This ticket is not linked to a chat conversation.');
    }

    const conversation = await this.conversations?.findById(
      ticket.conversationId
    );
    if (!conversation || conversation.requesterId !== ticket.requesterId) {
      throw badRequest('The linked chat conversation is not available.');
    }

    const messages = await this.conversations?.addMessages([
      {
        conversationId: ticket.conversationId,
        senderType: 'agent',
        content,
        outcome: null,
        sourceRefs: [],
      },
    ]);
    if (!messages?.length) {
      throw new HttpError(
        503,
        'service_unavailable',
        'The reply could not be saved. Please try again.'
      );
    }

    await this.repository.recordAudit({
      ticketId: ticket.id,
      action: 'ticket.agent_reply',
      actorId: context.userId,
      outcome: 'success',
      summary: `Agent sent a reply in chat for ${ticket.reference}.`,
    });
    return messages[0];
  }

  async generateSolutionDraft(
    ticketId: string,
    context: RequestContext
  ): Promise<{ content: string; model: string }> {
    const ticket = await this.requireAssignedAgentTicket(ticketId, context);
    if (!this.solutionGenerator) {
      throw new HttpError(
        503,
        'service_unavailable',
        'Gemini solution generation is not configured.'
      );
    }
    return {
      content: await this.solutionGenerator.generate(ticket),
      model: this.solutionGenerator.model,
    };
  }

  async saveSolutionDraft(
    ticketId: string,
    input: unknown,
    context: RequestContext
  ): Promise<TicketSolutionDraftRecord> {
    const ticket = await this.requireAssignedAgentTicket(ticketId, context);
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => key !== 'content')
    ) {
      throw badRequest('Solution draft must contain only content.');
    }
    const content = (input as Record<string, unknown>).content;
    if (
      typeof content !== 'string' ||
      !content.trim() ||
      content.length > 8000
    ) {
      throw badRequest('Solution draft must contain 1 to 8000 characters.');
    }
    if (!this.solutionGenerator) {
      throw new HttpError(
        503,
        'service_unavailable',
        'Gemini solution storage is not configured.'
      );
    }
    const draft = await this.repository.createSolutionDraft({
      ticketId: ticket.id,
      generatedBy: context.userId,
      content: content.trim(),
      model: this.solutionGenerator.model,
    });
    await this.repository.recordAudit({
      ticketId: ticket.id,
      action: 'ticket.gemini_draft_saved',
      actorId: context.userId,
      outcome: 'success',
      summary: `Gemini solution draft saved for ${ticket.reference}.`,
    });
    return draft;
  }

  private async requireAssignedAgentTicket(
    ticketId: string,
    context: RequestContext
  ): Promise<TicketRecord> {
    if (context.role !== 'agent') {
      throw forbidden('Only agents can generate or save solution drafts.');
    }
    if (!isUuid(ticketId)) throw notFound('Ticket not found.');
    const ticket = await this.repository.findById(ticketId);
    if (!ticket || ticket.assignedTo !== context.userId) {
      throw notFound('Ticket not found.');
    }
    return ticket;
  }

  async update(
    ticketId: string,
    input: unknown,
    context: RequestContext
  ): Promise<TicketRecord> {
    if (!isStaff(context)) {
      throw forbidden("You don't have permission to update this ticket.");
    }

    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw badRequest('Ticket update must be an object.');
    }
    const mutation = input as TicketMutation;
    const allowedFields = new Set([
      'status',
      'isOpen',
      'assigneeId',
      'notes',
      'reason',
      'expectedUpdatedAt',
    ]);
    if (Object.keys(mutation).some((field) => !allowedFields.has(field))) {
      throw badRequest('Ticket update contains an unexpected field.');
    }
    if (!isUuid(ticketId)) throw notFound('Ticket not found.');
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) throw notFound('Ticket not found.');
    if (context.role === 'agent' && 'assigneeId' in mutation) {
      throw forbidden('Only admins can assign tickets.');
    }
    if (context.role === 'agent' && ticket.assignedTo !== context.userId) {
      throw forbidden('This ticket is not assigned to you.');
    }

    if (
      mutation.expectedUpdatedAt !== undefined &&
      typeof mutation.expectedUpdatedAt !== 'string'
    ) {
      throw badRequest('expectedUpdatedAt must be a timestamp string.');
    }
    if (
      mutation.expectedUpdatedAt &&
      mutation.expectedUpdatedAt !== ticket.updatedAt
    ) {
      throw conflict();
    }

    const patch: TicketPatch = {};
    const changes: string[] = [];

    if (mutation.status !== undefined) {
      const status = normalizeStatus(mutation.status);
      assertTransition(ticket.status, status);
      if (status !== ticket.status) {
        patch.status = status;
        changes.push(`status ${ticket.status} → ${status}`);
      }
    }

    if (mutation.isOpen !== undefined) {
      if (typeof mutation.isOpen !== 'boolean') {
        throw badRequest('isOpen must be a boolean.');
      }
      if (mutation.isOpen !== ticket.isOpen) {
        if (typeof mutation.reason !== 'string' || !mutation.reason.trim()) {
          throw badRequest('A reason is required to close or reopen a ticket.');
        }
        if (mutation.reason.trim().length > 1000) {
          throw badRequest('Reason must be 1000 characters or fewer.');
        }
        patch.isOpen = mutation.isOpen;
        changes.push(
          `${mutation.isOpen ? 'ticket reopened' : 'ticket closed'}: ${mutation.reason.trim()}`
        );
      }
    }
    if ('reason' in mutation && mutation.isOpen === undefined) {
      throw badRequest(
        'reason can only be used when closing or reopening a ticket.'
      );
    }

    if (mutation.assigneeId !== undefined) {
      const assigneeId = mutation.assigneeId;
      if (assigneeId !== null && typeof assigneeId !== 'string') {
        throw badRequest('assigneeId must be a profile id or null.');
      }
      if (assigneeId) {
        const assignee = await this.profiles.findById(assigneeId);
        if (!assignee || assignee.role !== 'agent') {
          throw badRequest('Tickets can only be assigned to an agent.');
        }
      }
      if (assigneeId !== ticket.assignedTo) {
        patch.assignedTo = assigneeId;
        changes.push(assigneeId ? 'assignee updated' : 'unassigned');
      }
    }

    if (mutation.notes !== undefined) {
      if (typeof mutation.notes !== 'string') {
        throw badRequest('notes must be a string.');
      }
      const notes = mutation.notes.trim();
      if (notes) {
        const description = `${ticket.description}\n\nUpdate: ${notes}`;
        if (description.length > 5000) {
          throw badRequest('Ticket description would exceed 5000 characters.');
        }
        patch.description = description;
        changes.push('note added');
      }
    }

    if (!changes.length) return ticket;

    const updated = await this.repository.update(
      ticket.id,
      patch,
      ticket.updatedAt
    );
    if (!updated) throw conflict();

    await this.repository.recordAudit({
      ticketId: ticket.id,
      action: patch.status
        ? 'ticket.status_updated'
        : patch.isOpen !== undefined
          ? 'ticket.open_state_updated'
          : 'ticket.updated',
      actorId: context.userId,
      outcome: 'success',
      summary: `Ticket ${ticket.reference}: ${changes.join(', ')}.`,
    });

    if (
      patch.assignedTo &&
      patch.assignedTo !== ticket.assignedTo &&
      updated.conversationId
    ) {
      await this.conversations?.addMessages([
        {
          conversationId: updated.conversationId,
          senderType: 'system',
          content: [
            `Ticket ${updated.reference} assigned to ${updated.assigneeName ?? 'an IT agent'}.`,
            `Title: ${updated.title}`,
            `Category: ${updated.category}`,
            `Priority: ${updated.priority}`,
            `Description: ${updated.escalationSummary ?? updated.description}`,
          ].join('\n'),
          outcome: null,
          sourceRefs: [],
        },
      ]);
    }

    return updated;
  }

  async confirmResolution(
    ticketId: string,
    context: RequestContext
  ): Promise<TicketRecord> {
    if (context.role !== 'employee') {
      throw forbidden('Only employees can confirm ticket resolution.');
    }
    if (!isUuid(ticketId)) throw notFound('Ticket not found.');
    const ticket = await this.repository.findById(ticketId);
    if (!ticket || ticket.requesterId !== context.userId) {
      throw notFound('Ticket not found.');
    }
    if (ticket.status === 'resolved' && !ticket.isOpen) return ticket;

    const updated = await this.repository.update(
      ticket.id,
      { status: 'resolved', isOpen: false },
      ticket.updatedAt
    );
    if (!updated) throw new HttpError(409, 'conflict', 'Please try again.');
    await this.repository.recordAudit({
      ticketId: ticket.id,
      action: 'ticket.requester_confirmed_resolution',
      actorId: context.userId,
      outcome: 'success',
      summary: `Requester confirmed resolution for ${ticket.reference}.`,
    });
    return updated;
  }
}

function conflict(): HttpError {
  return new HttpError(
    409,
    'conflict',
    'This ticket was updated by someone else. Reload to see changes.'
  );
}
