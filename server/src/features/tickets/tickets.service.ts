import { randomUUID } from 'node:crypto';
import type {
  AuditLogEntry,
  RequestContext,
  TicketMutation,
  TicketPriority,
  TicketRecord,
  TicketRequest,
  TicketStatus,
} from './tickets.types.js';

const ticketStore = new Map<string, TicketRecord>();
const auditLog: AuditLogEntry[] = [];

const allowedStatuses: TicketStatus[] = [
  'new',
  'open',
  'in_progress',
  'pending',
  'resolved',
  'closed',
];

const validTransitions: Record<TicketStatus, TicketStatus[]> = {
  new: ['open', 'in_progress'],
  open: ['in_progress', 'pending', 'resolved'],
  in_progress: ['pending', 'resolved'],
  pending: ['open', 'resolved'],
  resolved: ['closed'],
  closed: [],
};

export function getAllTickets(): TicketRecord[] {
  return [...ticketStore.values()].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
  );
}

export function getTicketById(ticketId: string): TicketRecord | undefined {
  return ticketStore.get(ticketId);
}

export function getAuditEntries(ticketId: string): AuditLogEntry[] {
  return auditLog.filter((entry) => entry.ticketId === ticketId);
}

export function resolveRequestContext(
  requestMetadata: Partial<RequestContext> | undefined
): RequestContext {
  return {
    userId: requestMetadata?.userId ?? 'local-user',
    role: requestMetadata?.role ?? 'employee',
    displayName: requestMetadata?.displayName ?? 'Employee User',
  };
}

export function normalizePriority(
  priority: string | undefined
): TicketPriority {
  const value = (priority ?? 'medium').toLowerCase();

  if (
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'urgent'
  ) {
    return value;
  }

  throw new Error(
    'Ticket priority must be one of low, medium, high, or urgent.'
  );
}

export function validateTicketRequest(input: TicketRequest): TicketRequest {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description =
    typeof input.description === 'string' ? input.description.trim() : '';

  if (!title) {
    throw new Error('Ticket title is required.');
  }

  if (title.length > 120) {
    throw new Error('Ticket title must be 120 characters or fewer.');
  }

  if (!description) {
    throw new Error('Ticket description is required.');
  }

  if (description.length > 5000) {
    throw new Error('Ticket description must be 5000 characters or fewer.');
  }

  if (input.category !== undefined && typeof input.category !== 'string') {
    throw new Error('Ticket category must be a string when provided.');
  }

  const normalizedPriority = normalizePriority(input.priority);

  return {
    title,
    description,
    category: input.category?.trim() || 'general',
    priority: normalizedPriority,
    requesterId: input.requesterId ?? '',
    requesterName: input.requesterName ?? '',
  };
}

export function createTicket(
  request: TicketRequest,
  context: Partial<RequestContext> | undefined
): TicketRecord {
  const validated = validateTicketRequest(request);
  const resolvedContext = resolveRequestContext(context);

  const now = new Date().toISOString();
  const ticket: TicketRecord = {
    id: randomUUID(),
    title: validated.title,
    description: validated.description,
    category: validated.category ?? 'general',
    priority: validated.priority ?? 'medium',
    status: 'new',
    requesterId: resolvedContext.userId,
    requesterName: resolvedContext.displayName,
    createdAt: now,
    updatedAt: now,
  };

  ticketStore.set(ticket.id, ticket);

  const event: AuditLogEntry = {
    id: randomUUID(),
    ticketId: ticket.id,
    action: 'created',
    actorId: resolvedContext.userId,
    createdAt: now,
    summary: `Ticket created for ${ticket.requesterName}.`,
  };

  auditLog.push(event);

  return ticket;
}

export function updateTicket(
  ticketId: string,
  mutation: TicketMutation,
  context: Partial<RequestContext> | undefined
): TicketRecord {
  const ticket = ticketStore.get(ticketId);

  if (!ticket) {
    throw new Error('Ticket not found.');
  }

  const resolvedContext = resolveRequestContext(context);
  const beforeStatus = ticket.status;

  if (mutation.status) {
    const normalizedStatus = mutation.status.toLowerCase() as TicketStatus;

    if (!allowedStatuses.includes(normalizedStatus)) {
      throw new Error(
        `Ticket status must be one of ${allowedStatuses.join(', ')}.`
      );
    }

    if (!validTransitions[beforeStatus].includes(normalizedStatus)) {
      throw new Error(
        `Status transition from ${beforeStatus} to ${normalizedStatus} is not allowed.`
      );
    }

    ticket.status = normalizedStatus;
  }

  if (mutation.notes && mutation.notes.trim()) {
    ticket.description = `${ticket.description}\n\nUpdate: ${mutation.notes.trim()}`;
  }

  if (mutation.assigneeId) {
    ticket.requesterId = mutation.assigneeId;
  }

  ticket.updatedAt = new Date().toISOString();

  auditLog.push({
    id: randomUUID(),
    ticketId: ticket.id,
    action: mutation.status ? 'status_updated' : 'updated',
    beforeStatus,
    afterStatus: ticket.status,
    actorId: resolvedContext.userId,
    createdAt: ticket.updatedAt,
    summary: mutation.status
      ? `Status changed from ${beforeStatus} to ${ticket.status}.`
      : 'Ticket updated.',
  });

  return ticket;
}

export function resetTicketState(): void {
  ticketStore.clear();
  auditLog.length = 0;
}
