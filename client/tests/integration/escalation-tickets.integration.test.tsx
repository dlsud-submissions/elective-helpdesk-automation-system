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
  setSessionPersistence: vi.fn(),
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
    status: 'pending',
    isOpen: true,
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

describe('chat tickets and employee ticket view', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ session: { access_token: 'dana-token' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
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
            body: { ticket: ticket({ isEscalated: false, status: 'pending' }) },
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
    const archivedConversation = {
      id: CONVERSATION_ID,
      title: 'Printer shows offline',
      archivedAt: '2026-11-20T10:00:00.000Z',
      deletedAt: null,
      isUnread: false,
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    };
    const { calls } = mockApi(
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
        if (call.path === `/api/conversations/${CONVERSATION_ID}/messages`) {
          return {
            status: 200,
            body: { conversation: archivedConversation, messages: [] },
          };
        }
        if (
          call.path === `/api/conversations/${CONVERSATION_ID}` &&
          call.method === 'PATCH'
        ) {
          return {
            status: 200,
            body: {
              conversation: { ...archivedConversation, archivedAt: null },
            },
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
    expect(within(rows[0]!).getByText('Open')).toHaveClass(
      'ticket-row__open-state'
    );
    expect(rows[1]).toHaveTextContent('Resolved');
    await waitFor(() =>
      expect(document.title).toBe('My tickets · Harbor Tickets')
    );

    fireEvent.click(rows[0]!);
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Printer shows offline',
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText('Lee Santos')).toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('link', { name: 'Open the related chat' })
    );
    await screen.findByRole('heading', { level: 1, name: 'Ask IT' });
    expect(
      calls.find(
        (call) =>
          call.path === `/api/conversations/${CONVERSATION_ID}` &&
          call.method === 'PATCH'
      )?.body
    ).toEqual({ archived: false });
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

  it('shows an agent tickets assigned to them, not tickets they requested', async () => {
    fake = createFakeSupabase({ session: { access_token: 'lee-token' } });
    mockApi((call) => {
      const me = meHandler(profiles.lee)(call);
      if (me) return me;
      if (
        call.path === `/api/tickets/ffffffff-ffff-4fff-8fff-ffffffffffff` &&
        call.method === 'PATCH'
      ) {
        return {
          status: 200,
          body: {
            ticket: ticket({
              id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
              reference: 'TCK-3000',
              status: 'in_progress',
              requesterId: profiles.dana.id,
              assignedTo: profiles.lee.id,
              assigneeName: 'Lee Santos',
            }),
          },
        };
      }
      return call.path === '/api/tickets'
        ? {
            status: 200,
            body: {
              tickets: [
                ticket({
                  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                  reference: 'TCK-3000',
                  requesterId: profiles.dana.id,
                  assignedTo: profiles.lee.id,
                  assigneeName: 'Lee Santos',
                }),
                ticket({
                  id: '99999999-9999-4999-8999-999999999999',
                  reference: 'TCK-3001',
                  requesterId: profiles.lee.id,
                  assignedTo: profiles.ari.id,
                }),
              ],
            },
          }
        : undefined;
    });
    renderApp('/tickets');
    const list = await screen.findByRole('list', { name: 'Assigned tickets' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list).toHaveTextContent('TCK-3000');
    expect(list).not.toHaveTextContent('TCK-3001');
    expect(
      within(list).getByRole('link', { name: /TCK-3000/ })
    ).toHaveAttribute(
      'href',
      '/dashboard/ffffffff-ffff-4fff-8fff-ffffffffffff'
    );
    expect(screen.queryByRole('link', { name: 'Ask IT in chat' })).toBeNull();
    const status = within(list).getByLabelText('Status for TCK-3000');
    expect(status).toHaveValue('pending');
    fireEvent.change(status, { target: { value: 'in_progress' } });
    await waitFor(() => expect(status).toHaveValue('in_progress'));
    fireEvent.change(screen.getByLabelText('Search tickets'), {
      target: { value: 'no matching ticket' },
    });
    expect(
      await screen.findByText('No tickets match your search and filters.')
    ).toBeInTheDocument();
  });
});
