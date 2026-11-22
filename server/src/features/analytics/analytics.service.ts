import { badRequest } from '../../shared/http/errors.js';
import type {
  TicketPriority,
  TicketRecord,
  TicketStatus,
} from '../tickets/index.js';

export type DateRange = { from: Date; to: Date };

/**
 * Aggregate-only dashboard metrics. No ticket text, message content, or
 * requester identity is included. Definitions are documented in
 * docs/sprints/sprint-3/api-contracts.md.
 */
export type AnalyticsSummary = {
  range: { from: string; to: string };
  /** All tickets currently in the system, regardless of the date range. */
  totalTickets: number;
  /** Current status distribution of all tickets. */
  byStatus: Record<TicketStatus, number>;
  /** Priority distribution of open tickets (not resolved or closed). */
  openByPriority: Record<TicketPriority, number>;
  /** Open tickets flagged as escalated from chat. */
  openEscalated: number;
  /** Open tickets with no assignee. */
  openUnassigned: number;
  /** Tickets whose createdAt falls inside the range. */
  createdInRange: number;
  /** Tickets whose resolvedAt falls inside the range. */
  resolvedInRange: number;
};

export interface TicketSource {
  listAll(): Promise<TicketRecord[]>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;

const isOpen = (status: TicketStatus) =>
  status !== 'resolved' && status !== 'closed';

function parseDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw badRequest(`${field} must be a date.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be an ISO date (YYYY-MM-DD).`);
  }
  return date;
}

/**
 * Parses from/to query values. Date-only `to` values are inclusive of that
 * whole day. Defaults to the last 30 days.
 */
export function parseDateRange(
  query: { from?: unknown; to?: unknown },
  now = new Date()
): DateRange {
  const fromInput = parseDate(query.from, 'from');
  let to = parseDate(query.to, 'to') ?? now;
  if (typeof query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    to = new Date(to.getTime() + DAY_MS - 1);
  }
  const from =
    fromInput ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

  if (from > to) throw badRequest('from must be on or before to.');
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw badRequest(`Date range must be ${MAX_RANGE_DAYS} days or fewer.`);
  }
  return { from, to };
}

export function summarizeTickets(
  tickets: TicketRecord[],
  range: DateRange
): AnalyticsSummary {
  const byStatus: Record<TicketStatus, number> = {
    new: 0,
    open: 0,
    in_progress: 0,
    pending: 0,
    resolved: 0,
    closed: 0,
  };
  const openByPriority: Record<TicketPriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };
  const inRange = (value: string | null) => {
    if (!value) return false;
    const time = Date.parse(value);
    return time >= range.from.getTime() && time <= range.to.getTime();
  };

  let openEscalated = 0;
  let openUnassigned = 0;
  let createdInRange = 0;
  let resolvedInRange = 0;

  for (const ticket of tickets) {
    byStatus[ticket.status] += 1;
    if (isOpen(ticket.status)) {
      openByPriority[ticket.priority] += 1;
      if (ticket.isEscalated) openEscalated += 1;
      if (!ticket.assignedTo) openUnassigned += 1;
    }
    if (inRange(ticket.createdAt)) createdInRange += 1;
    if (inRange(ticket.resolvedAt)) resolvedInRange += 1;
  }

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    totalTickets: tickets.length,
    byStatus,
    openByPriority,
    openEscalated,
    openUnassigned,
    createdInRange,
    resolvedInRange,
  };
}

export class AnalyticsService {
  constructor(private readonly tickets: TicketSource) {}

  async summary(query: { from?: unknown; to?: unknown }) {
    const range = parseDateRange(query);
    return summarizeTickets(await this.tickets.listAll(), range);
  }
}
