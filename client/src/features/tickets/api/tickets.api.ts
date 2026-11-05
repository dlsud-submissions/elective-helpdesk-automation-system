import { apiFetch } from '../../../shared/api/http';
import type {
  AuditEntry,
  NewTicketInput,
  StaffMember,
  Ticket,
  TicketUpdate,
} from '../types';

export async function listTickets(): Promise<Ticket[]> {
  return (await apiFetch<{ tickets: Ticket[] }>('/api/tickets')).tickets;
}

export function getTicket(
  ticketId: string
): Promise<{ ticket: Ticket; audit: AuditEntry[] }> {
  return apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}`);
}

export async function updateTicket(
  ticketId: string,
  update: TicketUpdate
): Promise<Ticket> {
  return (
    await apiFetch<{ ticket: Ticket }>(
      `/api/tickets/${encodeURIComponent(ticketId)}`,
      { method: 'PATCH', body: update }
    )
  ).ticket;
}

export async function createTicket(input: NewTicketInput): Promise<Ticket> {
  return (
    await apiFetch<{ ticket: Ticket }>('/api/tickets', {
      method: 'POST',
      body: input,
    })
  ).ticket;
}

export async function listStaff(): Promise<StaffMember[]> {
  return (await apiFetch<{ agents: StaffMember[] }>('/api/agents')).agents;
}
