export type UserRole = 'employee' | 'agent' | 'admin';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export type ActionIntent =
  | 'create_ticket'
  | 'escalate_to_human'
  | 'send_test_notification'
  | 'request_clarification'
  | 'knowledge_question'
  | 'unsupported';

export interface ActionProposal {
  intent: ActionIntent;
  confidence: number;
  arguments: Record<string, unknown>;
  reason: string;
}

export interface ActionContext {
  conversation_id?: string;
}

export interface TicketResult {
  ticketId: string;
  status: string;
}

export interface EscalationResult extends TicketResult {
  queue: string;
}

export interface SimulationResult {
  runId: string;
  status: string;
}

export interface ActionRepository {
  createTicket(input: {
    requesterId: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    idempotencyKey: string;
    conversationId?: string;
  }): Promise<TicketResult>;
  escalateToHuman(input: {
    requesterId: string;
    title: string;
    summary: string;
    reason: string;
    conversationId?: string;
    idempotencyKey: string;
  }): Promise<EscalationResult>;
  recordTestNotification(input: {
    requesterId: string;
    channel: 'simulation';
    message: string;
    ticketId?: string;
    conversationId?: string;
    idempotencyKey: string;
  }): Promise<SimulationResult>;
}

export interface ActionAuthProvider {
  authenticate(accessToken: string): Promise<AuthenticatedUser | null>;
}
