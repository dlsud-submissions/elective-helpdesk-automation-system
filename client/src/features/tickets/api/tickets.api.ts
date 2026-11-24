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

export async function createTicket(
  input: NewTicketInput,
  idempotencyKey: string
): Promise<Ticket> {
  return (
    await apiFetch<{ ticket: Ticket }>('/api/tickets', {
      method: 'POST',
      body: input,
      idempotencyKey,
    })
  ).ticket;
}

export async function sendTicketReply(
  ticketId: string,
  content: string
): Promise<unknown> {
  return (
    await apiFetch<{ message: unknown }>(
      `/api/tickets/${encodeURIComponent(ticketId)}/messages`,
      { method: 'POST', body: { content } }
    )
  ).message;
}

export function generateTicketSolution(
  ticketId: string
): Promise<{ content: string; model: string }> {
  return apiFetch<{ solution: { content: string; model: string } }>(
    `/api/tickets/${encodeURIComponent(ticketId)}/solution-draft/generate`,
    { method: 'POST', body: {} }
  ).then((response) => response.solution);
}

export function saveTicketSolutionDraft(
  ticketId: string,
  content: string
): Promise<void> {
  return apiFetch(
    `/api/tickets/${encodeURIComponent(ticketId)}/solution-draft`,
    { method: 'POST', body: { content } }
  );
}

export async function listStaff(): Promise<StaffMember[]> {
  return (await apiFetch<{ agents: StaffMember[] }>('/api/agents')).agents;
}
