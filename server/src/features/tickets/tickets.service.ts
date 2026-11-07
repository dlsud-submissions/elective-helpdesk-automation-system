import {
  badRequest,
  forbidden,
  HttpError,
  notFound,
} from '../../shared/http/errors.js';
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
  TicketStatus,
  ValidatedTicketRequest,
} from './tickets.types.js';

export const allowedStatuses: TicketStatus[] = [
  'new',
  'open',
  'in_progress',
  'pending',
  'resolved',
  'closed',
];

export const validTransitions: Record<TicketStatus, TicketStatus[]> = {
  new: ['open', 'in_progress'],
  open: ['in_progress', 'pending', 'resolved'],
  in_progress: ['pending', 'resolved'],
  pending: ['open', 'resolved'],
  resolved: ['closed'],
  closed: [],
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
  const body = (input ?? {}) as Record<string, unknown>;
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

export class TicketService {
  constructor(
    private readonly repository: TicketRepository,
    private readonly profiles: TicketProfileLookup
  ) {}

  /** Requester identity always comes from the verified auth context. */
  async create(
    input: unknown,
    context: RequestContext,
    extras: Pick<
      NewTicket,
      'isEscalated' | 'conversationId' | 'escalationSummary'
    > = {}
  ): Promise<TicketRecord> {
    const validated = validateTicketRequest(input);
    const ticket = await this.repository.create({
      ...validated,
      ...extras,
      requesterId: context.userId,
    });
    await this.repository.recordAudit({
      ticketId: ticket.id,
      action: 'ticket.created',
      actorId: context.userId,
      outcome: 'success',
      summary: `Ticket ${ticket.reference} created.`,
    });
    return ticket;
  }

  /** Employees only see their own tickets; agents/admins see the full queue. */
  async list(context: RequestContext): Promise<TicketRecord[]> {
    return this.repository.list(
      isStaff(context) ? {} : { requesterId: context.userId }
    );
  }

  async get(
    ticketId: string,
    context: RequestContext
  ): Promise<{ ticket: TicketRecord; audit: AuditLogEntry[] }> {
    const ticket = await this.repository.findById(ticketId);
    // Return 404 rather than 403 so ticket IDs cannot be probed.
    if (
      !ticket ||
      (!isStaff(context) && ticket.requesterId !== context.userId)
    ) {
      throw notFound('Ticket not found.');
    }
    const audit = isStaff(context)
      ? await this.repository.listAudit(ticket.id)
      : [];
    return { ticket, audit };
  }

  async update(
    ticketId: string,
    input: unknown,
    context: RequestContext
  ): Promise<TicketRecord> {
    if (!isStaff(context)) {
      throw forbidden("You don't have permission to update this ticket.");
    }

    const mutation = (input ?? {}) as TicketMutation;
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) throw notFound('Ticket not found.');

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

    if (mutation.assigneeId !== undefined) {
      const assigneeId = mutation.assigneeId;
      if (assigneeId !== null && typeof assigneeId !== 'string') {
        throw badRequest('assigneeId must be a profile id or null.');
      }
      if (assigneeId) {
        const assignee = await this.profiles.findById(assigneeId);
        if (!assignee || assignee.role === 'employee') {
          throw badRequest(
            'Tickets can only be assigned to an agent or admin.'
          );
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
      action: patch.status ? 'ticket.status_updated' : 'ticket.updated',
      actorId: context.userId,
      outcome: 'success',
      summary: `Ticket ${ticket.reference}: ${changes.join(', ')}.`,
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
