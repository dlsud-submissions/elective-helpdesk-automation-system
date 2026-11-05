import type { Ticket, TicketPriority, TicketStatus } from '../types';

export const statusLabels: Record<TicketStatus, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const priorityLabels: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/** Mirrors server transitions for the select; the API remains authoritative. */
export const validTransitions: Record<TicketStatus, TicketStatus[]> = {
  new: ['open', 'in_progress'],
  open: ['in_progress', 'pending', 'resolved'],
  in_progress: ['pending', 'resolved'],
  pending: ['open', 'resolved'],
  resolved: ['closed'],
  closed: [],
};

export const statusOptionsFor = (current: TicketStatus): TicketStatus[] => [
  current,
  ...validTransitions[current],
];

const priorityRank: Record<TicketPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type QueueFilters = {
  search: string;
  status: TicketStatus | 'all' | 'active';
  escalatedOnly: boolean;
  unassignedOnly: boolean;
};

export const defaultFilters: QueueFilters = {
  search: '',
  status: 'active',
  escalatedOnly: false,
  unassignedOnly: false,
};

const isActive = (status: TicketStatus) =>
  status !== 'resolved' && status !== 'closed';

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
  const search = filters.search.trim().toLowerCase();
  return sortQueue(
    tickets.filter((ticket) => {
      if (filters.status === 'active' && !isActive(ticket.status)) return false;
      if (
        filters.status !== 'all' &&
        filters.status !== 'active' &&
        ticket.status !== filters.status
      ) {
        return false;
      }
      if (filters.escalatedOnly && !ticket.isEscalated) return false;
      if (filters.unassignedOnly && ticket.assignedTo) return false;
      if (
        search &&
        ![ticket.reference, ticket.title, ticket.requesterName, ticket.category]
          .join(' ')
          .toLowerCase()
          .includes(search)
      ) {
        return false;
      }
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
