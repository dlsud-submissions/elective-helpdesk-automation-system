import { apiFetch } from '../../../shared/api/http';

export type TicketStatusKey =
  'new' | 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriorityKey = 'low' | 'medium' | 'high' | 'urgent';

/** Aggregate-only metrics from GET /api/analytics/summary. */
export type AnalyticsSummary = {
  range: { from: string; to: string };
  totalTickets: number;
  byStatus: Record<TicketStatusKey, number>;
  openByPriority: Record<TicketPriorityKey, number>;
  openEscalated: number;
  openUnassigned: number;
  createdInRange: number;
  resolvedInRange: number;
};

export async function getAnalyticsSummary(range: {
  from: string;
  to: string;
}): Promise<AnalyticsSummary> {
  const params = new URLSearchParams(range);
  return (
    await apiFetch<{ summary: AnalyticsSummary }>(
      `/api/analytics/summary?${params.toString()}`
    )
  ).summary;
}
