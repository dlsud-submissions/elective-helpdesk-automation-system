import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toApiError, type ApiError } from '../../../shared/api/http';
import {
  DeniedState,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../../shared/ui/StatusViews';
import {
  getAnalyticsSummary,
  type AnalyticsSummary,
  type TicketPriorityKey,
  type TicketStatusKey,
} from '../api/analytics.api';

const statusLabels: Record<TicketStatusKey, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

const priorityLabels: Record<TicketPriorityKey, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function defaultRange(now = new Date()) {
  const from = new Date(now.getTime() - 29 * 86_400_000);
  return { from: isoDay(from), to: isoDay(now) };
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; summary: AnalyticsSummary }
  | { status: 'error'; error: ApiError };

export function DashboardPage() {
  const [range, setRange] = useState(defaultRange);
  const [applied, setApplied] = useState(range);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  const fetchSummary = useCallback(async (value: typeof range) => {
    setLoad({ status: 'loading' });
    try {
      setLoad({ status: 'ready', summary: await getAnalyticsSummary(value) });
    } catch (error) {
      setLoad({ status: 'error', error: toApiError(error) });
    }
  }, []);

  useEffect(() => {
    void fetchSummary(applied);
  }, [applied, fetchSummary]);

  function onApply(event: FormEvent) {
    event.preventDefault();
    if (!range.from || !range.to || range.from > range.to) {
      setRangeError('Choose a start date on or before the end date.');
      return;
    }
    setRangeError(null);
    setApplied({ ...range });
  }

  if (load.status === 'error' && load.error.kind === 'forbidden') {
    return <DeniedState />;
  }

  return (
    <section aria-labelledby="dashboard-title" className="dashboard">
      <h1 id="dashboard-title">Helpdesk dashboard</h1>

      <form className="filters" onSubmit={onApply} aria-label="Date range">
        <label className="field field--inline">
          <span>From</span>
          <input
            type="date"
            value={range.from}
            onChange={(event) =>
              setRange({ ...range, from: event.target.value })
            }
          />
        </label>
        <label className="field field--inline">
          <span>To</span>
          <input
            type="date"
            value={range.to}
            onChange={(event) => setRange({ ...range, to: event.target.value })}
          />
        </label>
        <button type="submit" className="button">
          Apply
        </button>
      </form>
      {rangeError ? (
        <p className="field__error" role="alert">
          {rangeError}
        </p>
      ) : null}

      {load.status === 'loading' ? (
        <LoadingState label="Loading metrics…" />
      ) : null}
      {load.status === 'error' ? (
        <ErrorState
          message={load.error.message}
          onRetry={() => void fetchSummary(applied)}
        />
      ) : null}

      {load.status === 'ready' && load.summary.totalTickets === 0 ? (
        <EmptyState>
          <p>No tickets yet. Metrics appear once tickets are created.</p>
        </EmptyState>
      ) : null}

      {load.status === 'ready' && load.summary.totalTickets > 0 ? (
        <SummaryView summary={load.summary} />
      ) : null}
    </section>
  );
}

function SummaryView({ summary }: { summary: AnalyticsSummary }) {
  const tiles: Array<{ label: string; value: number; hint: string }> = [
    {
      label: 'Open escalations',
      value: summary.openEscalated,
      hint: 'Escalated from chat and not yet resolved',
    },
    {
      label: 'Open unassigned',
      value: summary.openUnassigned,
      hint: 'Not resolved or closed, no assignee',
    },
    {
      label: 'Created in range',
      value: summary.createdInRange,
      hint: 'Tickets opened in the selected dates',
    },
    {
      label: 'Resolved in range',
      value: summary.resolvedInRange,
      hint: 'Tickets resolved in the selected dates',
    },
  ];

  return (
    <>
      <ul className="tiles" aria-label="Key metrics">
        {tiles.map((tile) => (
          <li key={tile.label} className="tile">
            <span className="tile__value">{tile.value}</span>
            <span className="tile__label">{tile.label}</span>
            <span className="muted small">{tile.hint}</span>
          </li>
        ))}
      </ul>

      <div className="tables">
        <table className="metric-table">
          <caption>
            Tickets by current status ({summary.totalTickets} total)
          </caption>
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">Tickets</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(statusLabels) as TicketStatusKey[]).map((status) => (
              <tr key={status}>
                <th scope="row">{statusLabels[status]}</th>
                <td>{summary.byStatus[status]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="metric-table">
          <caption>Open tickets by priority</caption>
          <thead>
            <tr>
              <th scope="col">Priority</th>
              <th scope="col">Tickets</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(priorityLabels) as TicketPriorityKey[]).map(
              (priority) => (
                <tr key={priority}>
                  <th scope="row">{priorityLabels[priority]}</th>
                  <td>{summary.openByPriority[priority]}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
