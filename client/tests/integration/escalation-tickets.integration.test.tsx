import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

const CONVERSATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ESCALATED_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function reply(question: string, outcome: string, content: string) {
  const now = '2026-11-20T10:00:00.000Z';
  return {
    conversationId: CONVERSATION_ID,
    conversation: {
      id: CONVERSATION_ID,
      title: question,
      createdAt: now,
      updatedAt: now,
    },
    userMessage: {
      id: 'm-user',
      conversationId: CONVERSATION_ID,
      senderType: 'user',
      content: question,
      outcome: null,
      sourceRefs: [],
      createdAt: now,
    },
    message: {
      id: 'm-assistant',
      conversationId: CONVERSATION_ID,
      senderType: 'assistant',
      content,
      outcome,
      sourceRefs: [],
      createdAt: '2026-11-20T10:00:01.000Z',
    },
    outcome,
  };
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: ESCALATED_ID,
    reference: 'TCK-2051',
    title: 'Printer shows offline',
    description: 'Printer shows offline',
    category: 'other',
    priority: 'medium',
    status: 'open',
    requesterId: profiles.dana.id,
    requesterName: 'Dana Cruz',
    assignedTo: null,
    assigneeName: null,
    isEscalated: true,
    conversationId: CONVERSATION_ID,
    escalationSummary: 'Employee question: Printer shows offline',
    resolvedAt: null,
    createdAt: '2026-11-20T10:00:02.000Z',
    updatedAt: '2026-11-20T10:00:02.000Z',
    ...overrides,
  };
}

function employeeApi(
  extra: (call: ApiCall) => ReturnType<Parameters<typeof mockApi>[0]>
) {
  return (call: ApiCall) =>
    meHandler(profiles.dana)(call) ??
    (call.path === '/api/conversations'
      ? { status: 200, body: { conversations: [] } }
      : undefined) ??
    extra(call);
}

async function askUncertain() {
  const input = await screen.findByLabelText('Describe your IT issue');
  fireEvent.change(input, { target: { value: 'Printer shows offline' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText('No approved procedure found');
}

describe('chat escalation to a human agent (S3-02/S3-03 with S3-05)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ session: { access_token: 'dana-token' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('confirms, escalates with the confirmation header, and shows the persisted reference', async () => {
    const { calls } = mockApi(
      employeeApi((call) => {
        if (call.path === '/api/chat/messages') {
          return {
            status: 201,
            body: reply(
              'Printer shows offline',
              'escalation_suggested',
              'I could not find an approved procedure.'
            ),
          };
        }
        if (call.path === '/api/actions/execute') {
          return {
            status: 201,
            body: {
              status: 'success',
              action: 'escalate_to_human',
              ticket_id: ESCALATED_ID,
              status_label: 'escalated',
              queue: 'IT-agents',
            },
          };
        }
        if (call.path === `/api/tickets/${ESCALATED_ID}`) {
          return { status: 200, body: { ticket: ticket(), audit: [] } };
        }
        return undefined;
      })
    );
    renderApp('/chat');
    await askUncertain();

    fireEvent.click(screen.getByRole('button', { name: 'Talk to a person' }));

    // Nothing is sent until the employee confirms.
    expect(calls.some((call) => call.path === '/api/actions/execute')).toBe(
      false
    );
    const heading = screen.getByRole('heading', {
      name: 'Talk to an IT agent',
    });
    expect(heading).toHaveFocus();
    const summary = screen.getByLabelText<HTMLTextAreaElement>(
      'Summary for the agent'
    );
    expect(summary.value).toContain('Employee question: Printer shows offline');
    expect(summary.value).toContain('no approved procedure was found');

    fireEvent.click(
      screen.getByRole('button', { name: 'Send to an IT agent' })
    );

    const status = await screen.findByText(/Sent to an IT agent as TCK-2051/);
    expect(status.closest('[role="status"]')).toHaveFocus();

    const execute = calls.filter(
      (call) => call.path === '/api/actions/execute'
    );
    expect(execute).toHaveLength(1);
    expect(execute[0]!.headers).toMatchObject({
      Authorization: 'Bearer dana-token',
      'X-Action-Confirmed': 'escalate_to_human',
    });
    expect(execute[0]!.headers['Idempotency-Key']).toBeTruthy();
    expect(execute[0]!.body).toMatchObject({
      proposal: {
        intent: 'escalate_to_human',
        arguments: { reason: 'low_confidence', title: 'Printer shows offline' },
      },
      context: { conversation_id: CONVERSATION_ID },
    });
  });

  it('shows a failure without claiming success and retries with the same key', async () => {
    let attempt = 0;
    const { calls } = mockApi(
      employeeApi((call) => {
        if (call.path === '/api/chat/messages') {
          return {
            status: 201,
            body: reply(
              'Printer shows offline',
              'escalation_suggested',
              'I could not find an approved procedure.'
            ),
          };
        }
        if (call.path === '/api/actions/execute') {
          attempt += 1;
          return attempt === 1
            ? {
                status: 502,
                body: {
                  status: 'error',
                  error:
                    'The action could not be completed. No successful outcome is available.',
                  code: 'action_failed',
                },
              }
            : {
                status: 201,
                body: {
                  status: 'success',
                  ticket_id: ESCALATED_ID,
                  queue: 'IT-agents',
                },
              };
        }
        if (call.path === `/api/tickets/${ESCALATED_ID}`) {
          return { status: 200, body: { ticket: ticket(), audit: [] } };
        }
        return undefined;
      })
    );
    renderApp('/chat');
    await askUncertain();
    fireEvent.click(screen.getByRole('button', { name: 'Talk to a person' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Send to an IT agent' })
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('not sent to an agent yet');
    expect(
      screen.queryByText(/Sent to an IT agent as/)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText(/Sent to an IT agent as TCK-2051/);

    const keys = calls
      .filter((call) => call.path === '/api/actions/execute')
      .map((call) => call.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('links a ticket created from chat to the conversation', async () => {
    const { calls } = mockApi(
      employeeApi((call) => {
        if (call.path === '/api/chat/messages') {
          return {
            status: 201,
            body: reply(
              'Printer shows offline',
              'escalation_suggested',
              'I could not find an approved procedure.'
            ),
          };
        }
        if (call.path === '/api/tickets' && call.method === 'POST') {
          return {
            status: 201,
            body: { ticket: ticket({ isEscalated: false, status: 'new' }) },
          };
        }
        return undefined;
      })
    );
    renderApp('/chat');
    await askUncertain();
    fireEvent.click(screen.getByRole('button', { name: 'Create a ticket' }));
    expect(
      screen.getByRole('heading', { name: 'Create a ticket' })
    ).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }));

    await screen.findByText(/Ticket TCK-2051 created/);
    const create = calls.find(
      (call) => call.path === '/api/tickets' && call.method === 'POST'
    );
    expect(create?.body).toMatchObject({ conversationId: CONVERSATION_ID });
  });

  it('links empty ticket fields to their errors and focuses the first one', async () => {
    mockApi(
      employeeApi((call) =>
        call.path === '/api/chat/messages'
          ? {
              status: 201,
              body: reply(
                'Printer shows offline',
                'escalation_suggested',
                'No procedure.'
              ),
            }
          : undefined
      )
    );
    renderApp('/chat');
    await askUncertain();
    fireEvent.click(screen.getByRole('button', { name: 'Create a ticket' }));
    const title = screen.getByLabelText('Title');
    fireEvent.change(title, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }));

    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription('Add a short title.');
  });
});

describe('my tickets (employee ticket view)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ session: { access_token: 'dana-token' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the employee’s tickets with text status and opens a read-only detail', async () => {
    mockApi(
      employeeApi((call) => {
        if (call.path === '/api/tickets') {
          return {
            status: 200,
            body: {
              tickets: [
                ticket(),
                ticket({
                  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                  reference: 'TCK-2040',
                  title: 'VPN drops',
                  status: 'resolved',
                  isEscalated: false,
                  updatedAt: '2026-11-19T10:00:00.000Z',
                }),
              ],
            },
          };
        }
        if (call.path === `/api/tickets/${ESCALATED_ID}`) {
          return {
            status: 200,
            body: { ticket: ticket({ assigneeName: 'Lee Santos' }), audit: [] },
          };
        }
        return undefined;
      })
    );
    renderApp('/tickets');

    const list = await screen.findByRole('list', { name: 'Your tickets' });
    const rows = within(list).getAllByRole('link');
    expect(rows[0]).toHaveTextContent('TCK-2051');
    expect(rows[0]).toHaveTextContent('Sent to an agent');
    expect(rows[1]).toHaveTextContent('Resolved');
    await waitFor(() =>
      expect(document.title).toBe('My tickets · IT Helpdesk')
    );

    fireEvent.click(rows[0]!);
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Printer shows offline',
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText('Lee Santos')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open the related chat' })
    ).toHaveAttribute('href', `/chat/${CONVERSATION_ID}`);
  });

  it('shows an empty state and a retryable error', async () => {
    let fail = true;
    mockApi(
      employeeApi((call) =>
        call.path === '/api/tickets'
          ? fail
            ? {
                status: 503,
                body: { error: 'Unavailable.', code: 'service_unavailable' },
              }
            : { status: 200, body: { tickets: [] } }
          : undefined
      )
    );
    renderApp('/tickets');
    const alert = await screen.findByRole('alert');
    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByText("You haven't created any tickets yet.")
    ).toBeInTheDocument();
  });

  it('shows only the staff member’s own tickets for agents', async () => {
    fake = createFakeSupabase({ session: { access_token: 'lee-token' } });
    mockApi(
      (call) =>
        meHandler(profiles.lee)(call) ??
        (call.path === '/api/tickets'
          ? {
              status: 200,
              body: {
                tickets: [
                  ticket(),
                  ticket({
                    id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                    reference: 'TCK-3000',
                    requesterId: profiles.lee.id,
                  }),
                ],
              },
            }
          : undefined)
    );
    renderApp('/tickets');
    const list = await screen.findByRole('list', { name: 'Your tickets' });
    expect(within(list).getAllByRole('link')).toHaveLength(1);
    expect(list).toHaveTextContent('TCK-3000');
  });
});
