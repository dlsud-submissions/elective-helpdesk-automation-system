import { apiFetch } from '../../../shared/api/http';

export type TicketStatusKey = 'pending' | 'in_progress' | 'resolved';
export type TicketPriorityKey = 'low' | 'medium' | 'high' | 'urgent';

/** Aggregate-only metrics from GET /api/analytics/summary. */
export type AnalyticsSummary = {
  totalTickets: number;
  assignedTickets?: number;
  byStatus: Record<TicketStatusKey, number>;
  openByPriority: Record<TicketPriorityKey, number>;
};

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return (
    await apiFetch<{ summary: AnalyticsSummary }>('/api/analytics/summary')
  ).summary;
}
