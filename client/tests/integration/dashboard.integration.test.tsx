import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeSupabase,
  meHandler,
  mockApi,
  profiles,
  renderApp,
  type ApiCall,
  type FakeSupabase,
} from '../helpers/fakes';

let fake: FakeSupabase;
vi.mock('../../src/shared/supabase/client', () => ({
  getSupabase: () => fake,
}));

const baseTicket = {
  description: 'Details',
  category: 'network',
  requesterId: 'u-dana',
  requesterName: 'Dana Cruz',
  assignedTo: null,
  assigneeName: null,
  conversationId: null,
  escalationSummary: null,
  resolvedAt: null,
};

const tickets = [
  {
    ...baseTicket,
    id: 't-low',
    reference: 'TCK-2003',
    title: 'Second monitor',
    priority: 'low',
    status: 'open',
    isEscalated: false,
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z',
  },
  {
    ...baseTicket,
    id: 't-esc',
    reference: 'TCK-2001',
    title: 'VPN drops on home network',
    priority: 'medium',
    status: 'open',
    isEscalated: true,
    escalationSummary: 'Symptoms: VPN disconnects every 10 minutes.',
    createdAt: '2026-11-19T10:00:00Z',
    updatedAt: '2026-11-19T10:00:00.123456+00:00',
  },
  {
    ...baseTicket,
    id: 't-high',
    reference: 'TCK-2002',
    title: 'Laptop will not boot',
    priority: 'high',
    status: 'new',
    isEscalated: false,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
  },
];

const staff = [{ id: 'u-lee', displayName: 'Lee Santos', role: 'agent' }];

function staffHandler(
  extra: (call: ApiCall) => ReturnType<Parameters<typeof mockApi>[0]> = () =>
    undefined,
  profile = profiles.ari
) {
  return (call: ApiCall) => {
    const me = meHandler(profile)(call);
    if (me) return me;
    const custom = extra(call);
    if (custom) return custom;
    if (call.path === '/api/tickets') return { status: 200, body: { tickets } };
    if (call.path === '/api/agents')
      return { status: 200, body: { agents: staff } };
    const detail = /^\/api\/tickets\/([^/]+)$/.exec(call.path);
    if (detail && call.method === 'GET') {
      return {
        status: 200,
        body: { ticket: tickets.find((t) => t.id === detail[1]), audit: [] },
      };
    }
    return undefined;
  };
}

describe('admin queue and ticket detail (S3-06)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ session: { access_token: 'lee-token' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sorts escalated first, then priority', async () => {
    mockApi(staffHandler());
    renderApp('/queue');

    const list = await screen.findByRole(
      'list',
      { name: 'Tickets' },
      { timeout: 5000 }
    );
    const refs = within(list)
      .getAllByRole('link')
      .map((link) => link.textContent?.match(/TCK-\d+/)?.[0]);
    expect(refs).toEqual(['TCK-2001', 'TCK-2002', 'TCK-2003']);
  });

  it('filters by status, assignee, and dates and shows an empty state', async () => {
    const assignedTickets = tickets.map((ticket) =>
      ticket.id === 't-esc'
        ? { ...ticket, assignedTo: 'u-lee', assigneeName: 'Lee Santos' }
        : ticket
    );
    mockApi(
      staffHandler((call) =>
        call.path === '/api/tickets'
          ? { status: 200, body: { tickets: assignedTickets } }
          : undefined
      )
    );
    renderApp('/queue');
    await screen.findByRole('list', { name: 'Tickets' });

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'open' },
    });
    fireEvent.change(screen.getByLabelText('Assigned'), {
      target: { value: 'u-lee' },
    });
    fireEvent.change(screen.getByLabelText('Created from'), {
      target: { value: '2026-11-19' },
    });
    fireEvent.change(screen.getByLabelText('Created to'), {
      target: { value: '2026-11-19' },
    });
    expect(screen.getAllByRole('link', { name: /TCK-/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /TCK-2001/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Created to'), {
      target: { value: '2026-11-18' },
    });
    expect(
      await screen.findByText('No tickets match these filters.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('list', { name: 'Tickets' })).toBeVisible();
  });

  it('saves status and assignment and shows the persisted result', async () => {
    const { calls } = mockApi(
      staffHandler((call) =>
        call.method === 'PATCH'
          ? {
              status: 200,
              body: {
                ticket: {
                  ...tickets[1],
                  status: 'in_progress',
                  assignedTo: 'u-lee',
                  assigneeName: 'Lee Santos',
                  updatedAt: '2026-11-20T11:00:00Z',
                },
              },
            }
          : undefined
      )
    );
    renderApp('/queue/t-esc');

    expect(
      await screen.findByText(/AI-generated, check before acting/)
    ).toBeInTheDocument();
    const detail = screen.getByRole('region', { name: 'Ticket detail' });
    fireEvent.change(within(detail).getByLabelText('Status'), {
      target: { value: 'in_progress' },
    });
    fireEvent.change(within(detail).getByLabelText('Assigned to'), {
      target: { value: 'u-lee' },
    });
    fireEvent.click(within(detail).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'Saved. Status is In progress, assigned to Lee Santos.'
      )
    ).toBeInTheDocument();
    const patch = calls.find((call) => call.method === 'PATCH')!;
    expect(patch.path).toBe('/api/tickets/t-esc');
    expect(patch.body).toEqual({
      expectedUpdatedAt: '2026-11-19T10:00:00.123456+00:00',
      status: 'in_progress',
      assigneeId: 'u-lee',
    });
  });

  it('reverts and explains a conflict', async () => {
    mockApi(
      staffHandler((call) =>
        call.method === 'PATCH'
          ? {
              status: 409,
              body: {
                error:
                  'This ticket was updated by someone else. Reload to see changes.',
                code: 'conflict',
              },
            }
          : undefined
      )
    );
    renderApp('/queue/t-esc');
    const detail = await screen.findByRole('region', { name: 'Ticket detail' });
    const status = await within(detail).findByLabelText('Status');
    fireEvent.change(status, { target: { value: 'pending' } });
    fireEvent.click(within(detail).getByRole('button', { name: 'Save' }));

    expect(await within(detail).findByRole('alert')).toHaveTextContent(
      'updated by someone else'
    );
    expect(within(detail).getByLabelText('Status')).toHaveValue('open');
    expect(
      screen.getByRole('button', { name: 'Reload ticket' })
    ).toBeInTheDocument();
  });

  it('shows the denied message when the API rejects the update', async () => {
    mockApi(
      staffHandler((call) =>
        call.method === 'PATCH'
          ? { status: 403, body: { error: 'Forbidden', code: 'forbidden' } }
          : undefined
      )
    );
    renderApp('/queue/t-esc');
    const detail = await screen.findByRole('region', { name: 'Ticket detail' });
    fireEvent.change(await within(detail).findByLabelText('Status'), {
      target: { value: 'pending' },
    });
    fireEvent.click(within(detail).getByRole('button', { name: 'Save' }));

    expect(await within(detail).findByRole('alert')).toHaveTextContent(
      "You don't have permission to update this ticket."
    );
  });
});

describe('dashboard analytics (S3-06)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ session: { access_token: 'lee-token' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const summary = {
    range: { from: '2026-10-22T00:00:00.000Z', to: '2026-11-20T23:59:59.999Z' },
    totalTickets: 7,
    assignedTickets: 4,
    byStatus: {
      new: 2,
      open: 2,
      in_progress: 1,
      pending: 0,
      resolved: 1,
      closed: 1,
    },
    openByPriority: { low: 1, medium: 2, high: 1, urgent: 1 },
    openEscalated: 3,
    openUnassigned: 4,
    createdInRange: 6,
    resolvedInRange: 2,
  };

  it('renders assigned, open, and resolved totals for admins', async () => {
    const { calls } = mockApi(
      staffHandler((call) =>
        call.path.startsWith('/api/analytics/summary')
          ? { status: 200, body: { summary } }
          : undefined
      )
    );
    renderApp('/dashboard');

    const tiles = await screen.findByRole('list', { name: 'Key metrics' });
    expect(
      within(tiles).getByText('Assigned tickets').previousSibling
    ).toHaveTextContent('4');
    expect(
      within(tiles).getByText('Open tickets').previousSibling
    ).toHaveTextContent('5');
    expect(
      within(tiles).getByText('Resolved tickets').previousSibling
    ).toHaveTextContent('2');
    expect(within(tiles).queryByText(/in range/)).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText(/From|To/)).toHaveLength(0);
    expect(calls.map((call) => call.path)).toContain('/api/analytics/summary');
  });

  it('shows assigned work but no admin-only metrics for agents', async () => {
    const assignedTicket = {
      ...tickets[0],
      id: 't-assigned',
      reference: 'TCK-2010',
      title: 'Assigned VPN issue',
      assignedTo: profiles.lee.id,
      assigneeName: 'Lee Santos',
      conversationId: 'conversation-1',
    };
    const agentSummary = {
      ...summary,
      totalTickets: 1,
      assignedTickets: undefined,
      byStatus: {
        new: 0,
        open: 1,
        in_progress: 0,
        pending: 0,
        resolved: 0,
        closed: 0,
      },
      openByPriority: { low: 0, medium: 1, high: 0, urgent: 0 },
    };
    const { calls } = mockApi(
      staffHandler((call) => {
        if (call.path.startsWith('/api/analytics/summary')) {
          return { status: 200, body: { summary: agentSummary } };
        }
        if (call.path === '/api/tickets') {
          return { status: 200, body: { tickets: [assignedTicket] } };
        }
        if (call.path === `/api/tickets/${assignedTicket.id}`) {
          return { status: 200, body: { ticket: assignedTicket, audit: [] } };
        }
        return undefined;
      }, profiles.lee)
    );
    renderApp('/dashboard');

    expect(
      await screen.findByRole('heading', { name: 'Agent dashboard' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Queue' })
    ).not.toBeInTheDocument();
    const metrics = await screen.findByRole('list', { name: 'Key metrics' });
    expect(within(metrics).getByText('All tickets')).toBeInTheDocument();
    expect(within(metrics).getByText('Open tickets')).toBeInTheDocument();
    expect(within(metrics).getByText('Resolved tickets')).toBeInTheDocument();
    expect(within(metrics).queryByText(/in range/)).not.toBeInTheDocument();
    const worklist = await screen.findByRole('list', {
      name: 'Assigned tickets',
    });
    fireEvent.click(within(worklist).getByRole('link', { name: /TCK-2010/ }));

    expect(
      await screen.findByLabelText('Solution or follow-up')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Assigned to')).not.toBeInTheDocument();
    expect(calls.some((call) => call.path === '/api/agents')).toBe(false);
  });

  it('shows created and resolved totals for employees', async () => {
    const employeeSummary = {
      ...summary,
      totalTickets: 3,
      byStatus: {
        new: 1,
        open: 1,
        in_progress: 0,
        pending: 0,
        resolved: 1,
        closed: 0,
      },
    };
    mockApi(
      staffHandler((call) => {
        if (call.path.startsWith('/api/analytics/summary')) {
          return { status: 200, body: { summary: employeeSummary } };
        }
        if (call.path === '/api/tickets') {
          return { status: 200, body: { tickets: [] } };
        }
        return undefined;
      }, profiles.dana)
    );
    renderApp('/dashboard');

    const tiles = await screen.findByRole('list', { name: 'Key metrics' });
    expect(
      within(tiles).getByText('Created tickets').previousSibling
    ).toHaveTextContent('3');
    expect(
      within(tiles).getByText('Resolved tickets').previousSibling
    ).toHaveTextContent('1');
    expect(within(tiles).queryByText('Open tickets')).not.toBeInTheDocument();
    expect(within(tiles).queryByText(/in range/)).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no tickets', async () => {
    mockApi(
      staffHandler((call) =>
        call.path.startsWith('/api/analytics/summary')
          ? { status: 200, body: { summary: { ...summary, totalTickets: 0 } } }
          : undefined
      )
    );
    renderApp('/dashboard');
    expect(await screen.findByText(/No tickets yet/)).toBeInTheDocument();
  });

  it('shows denied when the API refuses the role', async () => {
    mockApi(
      staffHandler((call) =>
        call.path.startsWith('/api/analytics/summary')
          ? { status: 403, body: { error: 'no', code: 'forbidden' } }
          : undefined
      )
    );
    renderApp('/dashboard');
    expect(
      await screen.findByRole('heading', { name: 'Access denied' })
    ).toBeInTheDocument();
  });

  it('shows a retryable error when the API fails', async () => {
    mockApi(
      staffHandler((call) =>
        call.path.startsWith('/api/analytics/summary')
          ? {
              status: 503,
              body: {
                error: 'The helpdesk database is unavailable.',
                code: 'service_unavailable',
              },
            }
          : undefined
      )
    );
    renderApp('/dashboard');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The helpdesk database is unavailable.');
    expect(
      within(alert).getByRole('button', { name: 'Retry' })
    ).toBeInTheDocument();
  });
});
