export type TicketStatus =
  | 'new'
  | 'open'
  | 'in_progress'
  | 'pending'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketRequest = {
  title: string;
  description: string;
  category?: string;
  priority?: TicketPriority;
  requesterId?: string;
  requesterName?: string;
};

export type TicketRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  requesterId: string;
  requesterName: string;
  createdAt: string;
  updatedAt: string;
};

export type TicketMutation = {
  status?: TicketStatus;
  assigneeId?: string;
  notes?: string;
};

export type RequestContext = {
  userId: string;
  role: 'employee' | 'agent' | 'admin';
  displayName: string;
};

export type AuditLogEntry = {
  id: string;
  ticketId: string;
  action: string;
  beforeStatus?: TicketStatus;
  afterStatus?: TicketStatus;
  actorId: string;
  createdAt: string;
  summary: string;
};
