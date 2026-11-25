import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  databaseError,
  getServiceClient,
} from '../../shared/database/index.js';
import type {
  AuditLogEntry,
  NewAuditEntry,
  NewTicket,
  NewTicketSolutionDraft,
  TicketListFilter,
  TicketPatch,
  TicketPriority,
  TicketRecord,
  TicketCreateResult,
  TicketRepository,
  TicketStatus,
  TicketSolutionDraftRecord,
} from './tickets.types.js';

export const formatTicketReference = (ticketNumber: number) =>
  `TCK-${ticketNumber}`;

const isResolved = (status: TicketStatus) => status === 'resolved';

/** Process-local repository for tests and offline development only. */
export class InMemoryTicketRepository implements TicketRepository {
  private readonly tickets = new Map<string, TicketRecord>();
  private readonly ticketsByIdempotencyKey = new Map<string, string>();
  private readonly audit: AuditLogEntry[] = [];
  private readonly solutionDrafts: TicketSolutionDraftRecord[] = [];
  private nextNumber = 2001;
  private clock = 0;

  constructor(
    private readonly names: (id: string) => string | null = () => null
  ) {}

  /** Monotonic timestamps so ordering and conflict checks are deterministic. */
  private now(): string {
    this.clock = Math.max(Date.now(), this.clock + 1);
    return new Date(this.clock).toISOString();
  }

  async create(input: NewTicket): Promise<TicketCreateResult> {
    const idempotencyKey = `${input.requesterId}:${input.idempotencyKey}`;
    const existingId = this.ticketsByIdempotencyKey.get(idempotencyKey);
    if (existingId) {
      const existing = this.tickets.get(existingId);
      if (existing) return { ticket: { ...existing }, created: false };
    }

    const now = this.now();
    const ticket: TicketRecord = {
      id: randomUUID(),
      reference: formatTicketReference(this.nextNumber++),
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: 'pending',
      isOpen: true,
      requesterId: input.requesterId,
      requesterName: this.names(input.requesterId) ?? 'Helpdesk user',
      assignedTo: null,
      assigneeName: null,
      isEscalated: input.isEscalated ?? false,
      conversationId: input.conversationId ?? null,
      escalationSummary: input.escalationSummary ?? null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.set(ticket.id, ticket);
    this.ticketsByIdempotencyKey.set(idempotencyKey, ticket.id);
    return { ticket: { ...ticket }, created: true };
  }

  async findById(id: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.get(id);
    return ticket ? { ...ticket } : null;
  }

  async findByConversationId(
    conversationId: string
  ): Promise<TicketRecord | null> {
    return (
      [...this.tickets.values()].find(
        (ticket) => ticket.conversationId === conversationId
      ) ?? null
    );
  }

  async list(filter: TicketListFilter): Promise<TicketRecord[]> {
    return [...this.tickets.values()]
      .filter(
        (ticket) =>
          (!filter.requesterId || ticket.requesterId === filter.requesterId) &&
          (!filter.assignedTo || ticket.assignedTo === filter.assignedTo)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((ticket) => ({ ...ticket }));
  }

  async update(
    id: string,
    patch: TicketPatch,
    expectedUpdatedAt?: string
  ): Promise<TicketRecord | null> {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;
    if (expectedUpdatedAt && ticket.updatedAt !== expectedUpdatedAt) {
      return null;
    }

    if (patch.status) {
      ticket.status = patch.status;
      ticket.resolvedAt = isResolved(patch.status)
        ? (ticket.resolvedAt ?? this.now())
        : null;
    }
    if (patch.isOpen !== undefined) ticket.isOpen = patch.isOpen;
    if (patch.assignedTo !== undefined) {
      ticket.assignedTo = patch.assignedTo;
      ticket.assigneeName = patch.assignedTo
        ? this.names(patch.assignedTo)
        : null;
    }
    if (patch.description !== undefined) {
      ticket.description = patch.description;
    }
    ticket.updatedAt = this.now();
    return { ...ticket };
  }

  async recordAudit(entry: NewAuditEntry): Promise<void> {
    this.audit.push({ ...entry, id: randomUUID(), createdAt: this.now() });
  }

  async listAudit(ticketId: string): Promise<AuditLogEntry[]> {
    return this.audit.filter((entry) => entry.ticketId === ticketId);
  }

  async createSolutionDraft(
    draft: NewTicketSolutionDraft
  ): Promise<TicketSolutionDraftRecord> {
    const saved = { ...draft, id: randomUUID(), createdAt: this.now() };
    this.solutionDrafts.push(saved);
    return { ...saved };
  }
}

type TicketRow = {
  id: string;
  ticket_number: number;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  is_open: boolean;
  requester_id: string;
  assigned_to: string | null;
  is_escalated: boolean;
  conversation_id: string | null;
  escalation_summary: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  requester: { display_name: string | null } | null;
  assignee: { display_name: string | null } | null;
};

type AuditRow = {
  id: string;
  resource_id: string;
  action: string;
  actor_id: string | null;
  outcome: AuditLogEntry['outcome'];
  summary: string | null;
  created_at: string;
};

type SolutionDraftRow = {
  id: string;
  ticket_id: string;
  generated_by: string;
  content: string;
  model: string;
  created_at: string;
};

const ticketColumns = `id, ticket_number, title, description, category, priority, status, is_open,
  requester_id, assigned_to, is_escalated, conversation_id, escalation_summary,
  resolved_at, created_at, updated_at,
  requester:profiles!tickets_requester_id_fkey(display_name),
  assignee:profiles!tickets_assigned_to_fkey(display_name)`;

function toTicket(row: TicketRow): TicketRecord {
  return {
    id: row.id,
    reference: formatTicketReference(row.ticket_number),
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    isOpen: row.is_open,
    requesterId: row.requester_id,
    requesterName: row.requester?.display_name ?? 'Helpdesk user',
    assignedTo: row.assigned_to,
    assigneeName: row.assigned_to
      ? (row.assignee?.display_name ?? 'Helpdesk agent')
      : null,
    isEscalated: row.is_escalated,
    conversationId: row.conversation_id,
    escalationSummary: row.escalation_summary,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Service-role repository; callers must authorize before using it. */
export class SupabaseTicketRepository implements TicketRepository {
  constructor(
    private readonly client: () => SupabaseClient = getServiceClient
  ) {}

  async create(input: NewTicket): Promise<TicketCreateResult> {
    const { data, error } = await this.client()
      .from('tickets')
      .upsert(
        {
          requester_id: input.requesterId,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          idempotency_key: input.idempotencyKey,
          is_escalated: input.isEscalated ?? false,
          conversation_id: input.conversationId ?? null,
          escalation_summary: input.escalationSummary ?? null,
        },
        {
          onConflict: 'requester_id,idempotency_key',
          ignoreDuplicates: true,
        }
      )
      .select(ticketColumns)
      .maybeSingle<TicketRow>();
    if (error) throw databaseError(error, 'ticket create');
    if (data) return { ticket: toTicket(data), created: true };

    const existing = await this.client()
      .from('tickets')
      .select(ticketColumns)
      .eq('requester_id', input.requesterId)
      .eq('idempotency_key', input.idempotencyKey)
      .single<TicketRow>();
    if (existing.error || !existing.data) {
      throw databaseError(existing.error, 'ticket idempotency lookup');
    }
    return { ticket: toTicket(existing.data), created: false };
  }

  async findById(id: string): Promise<TicketRecord | null> {
    const { data, error } = await this.client()
      .from('tickets')
      .select(ticketColumns)
      .eq('id', id)
      .maybeSingle<TicketRow>();
    if (error) throw databaseError(error, 'ticket read');
    return data ? toTicket(data) : null;
  }

  async findByConversationId(
    conversationId: string
  ): Promise<TicketRecord | null> {
    const { data, error } = await this.client()
      .from('tickets')
      .select(ticketColumns)
      .eq('conversation_id', conversationId)
      .maybeSingle<TicketRow>();
    if (error) throw databaseError(error, 'ticket conversation read');
    return data ? toTicket(data) : null;
  }

  async list(filter: TicketListFilter): Promise<TicketRecord[]> {
    let query = this.client()
      .from('tickets')
      .select(ticketColumns)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (filter.requesterId)
      query = query.eq('requester_id', filter.requesterId);
    if (filter.assignedTo) query = query.eq('assigned_to', filter.assignedTo);
    const { data, error } = await query.returns<TicketRow[]>();
    if (error) throw databaseError(error, 'ticket list');
    return (data ?? []).map(toTicket);
  }

  async update(
    id: string,
    patch: TicketPatch,
    expectedUpdatedAt?: string
  ): Promise<TicketRecord | null> {
    const changes: Record<string, unknown> = {};
    if (patch.status !== undefined) changes.status = patch.status;
    if (patch.isOpen !== undefined) changes.is_open = patch.isOpen;
    if (patch.assignedTo !== undefined) changes.assigned_to = patch.assignedTo;
    if (patch.description !== undefined)
      changes.description = patch.description;

    let query = this.client().from('tickets').update(changes).eq('id', id);
    if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt);
    const { data, error } = await query
      .select(ticketColumns)
      .maybeSingle<TicketRow>();
    if (error) throw databaseError(error, 'ticket update');
    return data ? toTicket(data) : null;
  }

  async recordAudit(entry: NewAuditEntry): Promise<void> {
    const { error } = await this.client().from('audit_logs').insert({
      actor_id: entry.actorId,
      action: entry.action,
      resource_type: 'ticket',
      resource_id: entry.ticketId,
      outcome: entry.outcome,
      summary: entry.summary,
    });
    if (error) throw databaseError(error, 'audit write');
  }

  async listAudit(ticketId: string): Promise<AuditLogEntry[]> {
    const { data, error } = await this.client()
      .from('audit_logs')
      .select('id, resource_id, action, actor_id, outcome, summary, created_at')
      .eq('resource_type', 'ticket')
      .eq('resource_id', ticketId)
      .order('created_at')
      .returns<AuditRow[]>();
    if (error) throw databaseError(error, 'audit read');
    return (data ?? []).map((row) => ({
      id: row.id,
      ticketId: row.resource_id,
      action: row.action,
      actorId: row.actor_id,
      outcome: row.outcome,
      summary: row.summary ?? '',
      createdAt: row.created_at,
    }));
  }

  async createSolutionDraft(
    draft: NewTicketSolutionDraft
  ): Promise<TicketSolutionDraftRecord> {
    const { data, error } = await this.client()
      .from('ticket_solution_drafts')
      .insert({
        ticket_id: draft.ticketId,
        generated_by: draft.generatedBy,
        content: draft.content,
        model: draft.model,
      })
      .select('id, ticket_id, generated_by, content, model, created_at')
      .single<SolutionDraftRow>();
    if (error || !data)
      throw databaseError(error, 'ticket solution draft create');
    return {
      id: data.id,
      ticketId: data.ticket_id,
      generatedBy: data.generated_by,
      content: data.content,
      model: data.model,
      createdAt: data.created_at,
    };
  }
}
