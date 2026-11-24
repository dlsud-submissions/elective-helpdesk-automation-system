export type TicketStatus =
  'new' | 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

/** Mirrors the server TicketRecord contract (docs/sprints/sprint-3/api-contracts.md). */
export type Ticket = {
  id: string;
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

export type AuditEntry = {
  id: string;
  action: string;
  actorId: string | null;
  outcome: string;
  summary: string;
  createdAt: string;
};

export type StaffMember = {
  id: string;
  displayName: string;
  role: 'agent';
};

export type TicketUpdate = {
  status?: TicketStatus;
  assigneeId?: string | null;
  notes?: string;
  expectedUpdatedAt: string;
};

export type NewTicketInput = {
  title: string;
  description: string;
  category?: string;
  priority?: TicketPriority;
  /** Links the ticket to the chat it came from (must be the caller's own). */
  conversationId?: string;
};
