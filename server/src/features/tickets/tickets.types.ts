import type { AuthContext, ProfileRecord } from '../auth/index.js';

export type TicketStatus =
  'new' | 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

/** Caller-supplied ticket fields. Requester identity is never accepted here. */
export type TicketRequest = {
  title: string;
  description: string;
  category?: string;
  priority?: TicketPriority;
};

export type ValidatedTicketRequest = Required<TicketRequest>;

export type TicketRecord = {
  id: string;
  /** Human-friendly reference, e.g. TCK-2049. */
  reference: string;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  requesterId: string;
  requesterName: string;
  assignedTo: string | null;
  assigneeName: string | null;
  isEscalated: boolean;
  conversationId: string | null;
  escalationSummary: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewTicket = ValidatedTicketRequest & {
  requesterId: string;
  isEscalated?: boolean;
  conversationId?: string | null;
  escalationSummary?: string | null;
};

export type TicketMutation = {
  status?: TicketStatus;
  /** Profile id of an agent/admin, or null to unassign. */
  assigneeId?: string | null;
  notes?: string;
  /** Optimistic concurrency token: the updatedAt the caller last saw. */
  expectedUpdatedAt?: string;
};

export type TicketPatch = {
  status?: TicketStatus;
  assignedTo?: string | null;
  description?: string;
};

export type RequestContext = AuthContext;

export type AuditLogEntry = {
  id: string;
  ticketId: string;
  action: string;
  actorId: string | null;
  outcome: 'success' | 'denied' | 'failed';
  createdAt: string;
  summary: string;
};

export type NewAuditEntry = Omit<AuditLogEntry, 'id' | 'createdAt'>;

export type TicketListFilter = {
  requesterId?: string;
};

export interface TicketRepository {
  create(ticket: NewTicket): Promise<TicketRecord>;
  findById(id: string): Promise<TicketRecord | null>;
  list(filter: TicketListFilter): Promise<TicketRecord[]>;
  /** Returns null when expectedUpdatedAt no longer matches (conflict). */
  update(
    id: string,
    patch: TicketPatch,
    expectedUpdatedAt?: string
  ): Promise<TicketRecord | null>;
  recordAudit(entry: NewAuditEntry): Promise<void>;
  listAudit(ticketId: string): Promise<AuditLogEntry[]>;
}

/** The subset of the auth profile directory the ticket service needs. */
export interface TicketProfileLookup {
  findById(id: string): Promise<ProfileRecord | null>;
}
