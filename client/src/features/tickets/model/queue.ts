import type { Ticket, TicketPriority, TicketStatus } from '../types';

export const statusLabels: Record<TicketStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export const priorityLabels: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/** Mirrors server transitions for the select; the API remains authoritative. */
export const statusOptions: TicketStatus[] = [
  'pending',
  'in_progress',
  'resolved',
];

const priorityRank: Record<TicketPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type QueueFilters = {
  status: TicketStatus | 'all' | 'active';
  assignedTo: string;
  createdFrom: string;
  createdTo: string;
};

export const defaultFilters: QueueFilters = {
  status: 'active',
  assignedTo: 'all',
  createdFrom: '',
  createdTo: '',
};

const isActive = (ticket: Ticket) => ticket.isOpen;

/** Escalated first, then priority, then oldest first. */
export function sortQueue(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    if (a.isEscalated !== b.isEscalated) return a.isEscalated ? -1 : 1;
    const priority = priorityRank[a.priority] - priorityRank[b.priority];
    if (priority !== 0) return priority;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function filterQueue(
  tickets: Ticket[],
  filters: QueueFilters
): Ticket[] {
  return sortQueue(
    tickets.filter((ticket) => {
      if (filters.status === 'active' && !isActive(ticket)) return false;
      if (
        filters.status !== 'all' &&
        filters.status !== 'active' &&
        ticket.status !== filters.status
      ) {
        return false;
      }
      if (filters.assignedTo === 'unassigned' && ticket.assignedTo !== null)
        return false;
      if (
        filters.assignedTo !== 'all' &&
        filters.assignedTo !== 'unassigned' &&
        ticket.assignedTo !== filters.assignedTo
      )
        return false;
      const createdDate = ticket.createdAt.slice(0, 10);
      if (filters.createdFrom && createdDate < filters.createdFrom)
        return false;
      if (filters.createdTo && createdDate > filters.createdTo) return false;
      return true;
    })
  );
}

export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
