import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeSupabase,
  deferred,
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

let clock = Date.parse('2026-11-20T10:00:00Z');
const at = () => new Date((clock += 1000)).toISOString();

function messagePair(
  content: string,
  reply: {
    outcome: string;
    content: string;
    sourceRefs?: unknown[];
    conversationId?: string;
  }
) {
  const conversationId = reply.conversationId ?? 'c-1';
  return {
    conversationId,
    conversation: {
      id: conversationId,
      title: content,
      createdAt: at(),
      updatedAt: at(),
    },
    userMessage: {
      id: `m-${clock}-u`,
      conversationId,
      senderType: 'user',
      content,
      outcome: null,
      sourceRefs: [],
      createdAt: at(),
    },
    message: {
      id: `m-${clock}-a`,
      conversationId,
      senderType: 'assistant',
      content: reply.content,
      outcome: reply.outcome,
      sourceRefs: reply.sourceRefs ?? [],
      createdAt: at(),
    },
    outcome: reply.outcome,
  };
}

const mfaSource = {
  articleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  title: 'MFA reset procedures',
  sourceName: 'IT Operations Guide',
  excerpt: 'MFA reset requests should be reviewed against the device registry.',
  relevance: 0.8,
};

function baseHandler(
  extra: (call: ApiCall) => ReturnType<Parameters<typeof mockApi>[0]>
) {
  return (call: ApiCall) =>
    meHandler(profiles.dana)(call) ??
    (call.path === '/api/conversations'
      ? { status: 200, body: { conversations: [] } }
      : call.path.endsWith('/read') && call.method === 'POST'
        ? { status: 204 }
        : call.path === '/api/tickets' && call.method === 'GET'
          ? { status: 200, body: { tickets: [] } }
          : undefined) ??
    extra(call);
}

async function ask(text: string) {
  const input = await screen.findByLabelText('Describe your IT issue');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

describe('employee chat (S3-02, S3-03)', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ session: { access_token: 'dana-token' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps chat history visible and resizes independently of main navigation', async () => {
    localStorage.removeItem('harbor-sidebar-collapsed');
    localStorage.removeItem('harbor-chat-sidebar-width');
    mockApi(baseHandler(() => undefined));
    renderApp('/chat');

    await screen.findByRole('heading', { level: 1, name: 'Ask IT' });
    const layout = document.querySelector('.chat-layout')!;
    expect(layout).toHaveStyle({ '--chat-sidebar-width': '420px' });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(layout).toHaveStyle({ '--chat-sidebar-width': '220px' });
    expect(document.querySelector('.app-main')).toHaveClass(
      'app-main--chat-sidebar-collapsed'
    );
    expect(
      screen.getByRole('complementary', {
        name: 'Conversations',
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Collapse chat sidebar' })
    ).not.toBeInTheDocument();

    const resizer = screen.getByRole('separator', {
      name: 'Resize chat sidebar',
    });
    const width = Number(resizer.getAttribute('aria-valuenow'));
    const storedWidth = Number(
      localStorage.getItem('harbor-chat-sidebar-width')
    );
    fireEvent.keyDown(resizer, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(resizer).toHaveAttribute('aria-valuenow', String(width + 24))
    );
    expect(localStorage.getItem('harbor-chat-sidebar-width')).toBe(
      String(storedWidth + 24)
    );
  });

  it('sends a question with the session token and renders a cited answer', async () => {
    const { calls } = mockApi(
      baseHandler((call) =>
        call.path === '/api/chat/messages'
          ? {
              status: 201,
              body: messagePair('I lost my phone, how do I reset MFA?', {
                outcome: 'answered',
                content: 'Confirm your contact details, then re-enroll. [1]',
                sourceRefs: [mfaSource],
              }),
            }
          : undefined
      )
    );
    renderApp('/chat');
    await ask('I lost my phone, how do I reset MFA?');

    const log = await screen.findByRole('log');
    expect(
      await within(log).findByText(/Confirm your contact details/)
    ).toBeInTheDocument();
    const sources = within(log).getByRole('heading', {
      name: 'Sources',
    }).parentElement!;
    expect(sources).toHaveTextContent('[1] MFA reset procedures');
    // Source references are rendered separately from the answer text.
    expect(
      within(log).getByText(/Confirm your contact details/)
    ).not.toHaveTextContent('MFA reset procedures');

    const send = calls.find((call) => call.path === '/api/chat/messages')!;
    expect(send.method).toBe('POST');
    expect(send.body).toEqual({
      content: 'I lost my phone, how do I reset MFA?',
    });
    expect(send.headers.Authorization).toBe('Bearer dana-token');
    expect(JSON.stringify(send)).not.toMatch(/service|gemini/i);
  });

  it('continues the same conversation on follow-up questions', async () => {
    const { calls } = mockApi(
      baseHandler((call) => {
        if (call.path !== '/api/chat/messages') return undefined;
        const body = call.body as { content: string };
        return {
          status: 201,
          body: messagePair(body.content, {
            outcome: 'answered',
            content: `Answer to ${body.content}`,
          }),
        };
      })
    );
    renderApp('/chat');
    await ask('First question');
    await screen.findByText('Answer to First question');
    await ask('Second question');
    await screen.findByText('Answer to Second question');

    const sends = calls.filter((call) => call.path === '/api/chat/messages');
    expect(sends[1]!.body).toEqual({
      content: 'Second question',
      conversationId: 'c-1',
    });

    const items = within(screen.getByRole('log'))
      .getAllByRole('article')
      .map((article) => article.getAttribute('aria-label'));
    expect(items).toEqual(['You', 'Harbor', 'You', 'Harbor']);
  });

  it('sends employee follow-ups to the assigned agent without an AI response', async () => {
    const conversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const now = '2026-11-20T10:00:00.000Z';
    const conversation = {
      id: conversationId,
      title: 'VPN disconnects',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      deletedAt: null,
      isUnread: false,
    };
    const ticket = {
      id: 't-assigned',
      reference: 'TCK-2091',
      title: 'VPN disconnects',
      description: 'VPN disconnects during calls.',
      category: 'network',
      priority: 'medium',
      status: 'in_progress',
      isOpen: true,
      requesterId: profiles.dana.id,
      requesterName: 'Dana Cruz',
      assignedTo: 'lee-id',
      assigneeName: 'Lee Santos',
      isEscalated: true,
      conversationId,
      escalationSummary: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const initialMessages = [
      {
        id: 'm-original',
        conversationId,
        senderType: 'user',
        content: 'VPN disconnects during calls.',
        outcome: null,
        sourceRefs: [],
        createdAt: now,
      },
      {
        id: 'm-ticket',
        conversationId,
        senderType: 'system',
        content: 'Ticket TCK-2091 assigned to Lee Santos.',
        outcome: null,
        sourceRefs: [],
        createdAt: now,
      },
    ];
    const { calls } = mockApi(
      (call) =>
        meHandler(profiles.dana)(call) ??
        (call.path === '/api/conversations'
          ? { status: 200, body: { conversations: [conversation] } }
          : call.path === `/api/conversations/${conversationId}/messages`
            ? {
                status: 200,
                body: { conversation, messages: initialMessages },
              }
            : call.path === '/api/tickets'
              ? { status: 200, body: { tickets: [ticket] } }
              : call.path === '/api/chat/messages'
                ? {
                    status: 201,
                    body: {
                      conversationId,
                      conversation,
                      userMessage: {
                        id: 'm-follow-up',
                        conversationId,
                        senderType: 'user',
                        content: 'It still disconnects.',
                        outcome: null,
                        sourceRefs: [],
                        createdAt: '2026-11-20T10:01:00.000Z',
                      },
                      message: null,
                      outcome: 'agent_assigned',
                    },
                  }
                : undefined)
    );
    renderApp(`/chat/${conversationId}`);

    expect(
      await screen.findByText(/AI responses are disabled for this ticket/)
    ).toHaveTextContent('Lee Santos');
    expect(screen.queryByText('How can we help?')).not.toBeInTheDocument();
    await ask('It still disconnects.');

    const log = await screen.findByRole('log');
    expect(within(log).getByText('It still disconnects.')).toBeInTheDocument();
    expect(within(log).queryByRole('article', { name: 'Harbor' })).toBeNull();
    expect(
      calls.some(
        (call) =>
          call.path === '/api/chat/messages' &&
          (call.body as { conversationId?: string }).conversationId ===
            conversationId
      )
    ).toBe(true);
  });

  it('searches, filters, sorts, and marks conversations as read', async () => {
    let unread = true;
    const items = [
      {
        id: 'c-vpn',
        title: 'VPN access',
        createdAt: '2026-11-20T10:00:00.000Z',
        updatedAt: '2026-11-20T10:05:00.000Z',
      },
      {
        id: 'c-mfa',
        title: 'MFA reset',
        createdAt: '2026-11-20T09:00:00.000Z',
        updatedAt: '2026-11-20T09:05:00.000Z',
      },
    ];
    const { calls } = mockApi(
      (call) =>
        meHandler(profiles.dana)(call) ??
        (call.path === '/api/conversations'
          ? {
              status: 200,
              body: {
                conversations: items.map((item) => ({
                  ...item,
                  isUnread: item.id === 'c-vpn' && unread,
                })),
              },
            }
          : call.path === '/api/conversations/c-vpn/read'
            ? ((unread = false), { status: 204 })
            : call.path === '/api/tickets'
              ? { status: 200, body: { tickets: [] } }
              : undefined)
    );
    renderApp('/chat');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show chat search' })
    );
    let search = await screen.findByRole('searchbox', {
      name: 'Search chats',
    });
    expect(screen.getByText('VPN access')).toBeInTheDocument();
    expect(screen.getByText('MFA reset')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide chat search' }));
    expect(
      screen.queryByRole('searchbox', { name: 'Search chats' })
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show chat search' }));
    search = await screen.findByRole('searchbox', { name: 'Search chats' });

    fireEvent.change(search, { target: { value: 'vpn' } });
    expect(screen.getByText('VPN access')).toBeInTheDocument();
    expect(screen.queryByText('MFA reset')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show chat filter' }));
    fireEvent.change(screen.getByLabelText('Filter chats'), {
      target: { value: 'unread' },
    });
    expect(screen.getByText('VPN access')).toBeInTheDocument();
    expect(screen.queryByText('MFA reset')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show chat sort' }));
    fireEvent.change(screen.getByLabelText('Sort chats'), {
      target: { value: 'title' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Chat actions for VPN access' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'POST' &&
            call.path === '/api/conversations/c-vpn/read'
        )
      ).toBe(true)
    );
    expect(
      await screen.findByText('No chats match these controls.')
    ).toBeInTheDocument();
  });

  it('asks employees if an agent reply resolved their linked ticket', async () => {
    const conversationId = 'c-feedback';
    const ticket = {
      id: 't-feedback',
      reference: 'TCK-2090',
      title: 'VPN reconnect issue',
      description: 'VPN disconnects during calls.',
      category: 'network',
      priority: 'medium',
      status: 'in_progress',
      isOpen: true,
      requesterId: profiles.dana.id,
      requesterName: 'Dana Cruz',
      assignedTo: 'u-lee',
      assigneeName: 'Lee Santos',
      isEscalated: false,
      conversationId,
      escalationSummary: null,
      resolvedAt: null,
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    };
    const conversation = {
      id: conversationId,
      title: ticket.title,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      archivedAt: null,
      deletedAt: null,
      isUnread: true,
    };
    const agentMessage = {
      id: 'm-agent-feedback',
      conversationId,
      senderType: 'agent',
      content: 'I updated your VPN profile.',
      outcome: null,
      sourceRefs: [],
      createdAt: '2026-11-20T10:01:00.000Z',
    };
    const secondAgentMessage = {
      ...agentMessage,
      id: 'm-agent-feedback-2',
      content: 'Please try connecting again now.',
      createdAt: '2026-11-20T10:02:00.000Z',
    };
    const { calls } = mockApi(
      (call) =>
        meHandler(profiles.dana)(call) ??
        (call.path === '/api/conversations'
          ? { status: 200, body: { conversations: [conversation] } }
          : call.path === `/api/conversations/${conversationId}/messages`
            ? {
                status: 200,
                body: {
                  conversation,
                  messages: [agentMessage, secondAgentMessage],
                },
              }
            : call.path === `/api/conversations/${conversationId}/read`
              ? { status: 204 }
              : call.path === '/api/tickets'
                ? { status: 200, body: { tickets: [ticket] } }
                : call.path === `/api/tickets/${ticket.id}/confirm-resolution`
                  ? {
                      status: 200,
                      body: {
                        ticket: {
                          ...ticket,
                          status: 'resolved',
                          isOpen: false,
                          resolvedAt: '2026-11-20T10:02:00.000Z',
                        },
                      },
                    }
                  : undefined)
    );
    renderApp(`/chat/${conversationId}`);
    expect(
      await screen.findAllByText('Has this solved your issue?')
    ).toHaveLength(2);
    const feedbackPanels = screen.getAllByRole('region', {
      name: 'Issue resolution feedback',
    });
    fireEvent.click(
      within(feedbackPanels[0]!).getByRole('button', { name: 'No' })
    );
    expect(
      within(feedbackPanels[0]!).getByText(
        "Thanks for letting us know. We'll keep working on it."
      )
    ).toBeInTheDocument();
    expect(
      calls.some((call) => call.path.endsWith('/confirm-resolution'))
    ).toBe(false);
    fireEvent.click(
      within(feedbackPanels[1]!).getByRole('button', { name: 'Yes' })
    );

    expect(
      await screen.findByText('Thanks for confirming. The ticket is resolved.')
    ).toBeInTheDocument();
    expect(
      calls.some(
        (call) =>
          call.method === 'POST' &&
          call.path === `/api/tickets/${ticket.id}/confirm-resolution`
      )
    ).toBe(true);
    expect(
      screen.queryByRole('button', { name: 'No' })
    ).not.toBeInTheDocument();
  });

  it('shows the uncertain state and creates a ticket only after persistence', async () => {
    mockApi(
      baseHandler((call) => {
        if (call.path === '/api/chat/messages') {
          return {
            status: 201,
            body: messagePair('Payroll bank change', {
              outcome: 'escalation_suggested',
              content: 'I could not find enough approved internal guidance.',
            }),
          };
        }
        if (call.path === '/api/tickets' && call.method === 'POST') {
          return {
            status: 201,
            body: {
              ticket: { id: 't-1', reference: 'TCK-2001', status: 'pending' },
            },
          };
        }
        return undefined;
      })
    );
    renderApp('/chat');
    await ask('Payroll bank change');

    expect(
      await screen.findByText('No approved procedure found')
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sources' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create a ticket' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Payroll bank change');
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }));

    expect(
      await screen.findByText('Ticket TCK-2001 created.')
    ).toBeInTheDocument();
  });

  it('lets agents resolve assigned tickets from chat before archiving or deleting', async () => {
    fake = createFakeSupabase({ session: { access_token: 'lee-token' } });
    const conversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const assignedTicket = {
      id: 't-assigned',
      reference: 'TCK-2010',
      title: 'VPN drops on home network',
      description: 'VPN disconnects every 10 minutes.',
      category: 'network',
      priority: 'high',
      status: 'in_progress',
      isOpen: true,
      requesterId: profiles.dana.id,
      requesterName: 'Dana Cruz',
      assignedTo: profiles.lee.id,
      assigneeName: 'Lee Santos',
      isEscalated: false,
      conversationId,
      escalationSummary: null,
      resolvedAt: null,
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    };
    const assignedConversation = {
      id: conversationId,
      title: assignedTicket.title,
      createdAt: assignedTicket.createdAt,
      updatedAt: assignedTicket.updatedAt,
      archivedAt: null,
      deletedAt: null,
    };
    const { calls } = mockApi(
      (call) =>
        meHandler(profiles.lee)(call) ??
        (call.path === '/api/conversations'
          ? {
              status: 200,
              body: { conversations: [assignedConversation] },
            }
          : undefined) ??
        (call.path === `/api/conversations/${conversationId}/read`
          ? { status: 204 }
          : undefined) ??
        (call.path === '/api/tickets'
          ? { status: 200, body: { tickets: [assignedTicket] } }
          : undefined) ??
        (call.path === `/api/conversations/${conversationId}/messages`
          ? {
              status: 200,
              body: {
                conversation: assignedConversation,
                messages: [
                  {
                    id: 'm-assignment',
                    conversationId,
                    senderType: 'system',
                    content:
                      'Ticket TCK-2010 assigned to Lee Santos.\nTitle: VPN drops on home network\nDescription: VPN disconnects every 10 minutes.',
                    outcome: null,
                    sourceRefs: [],
                    createdAt: '2026-11-20T10:01:00.000Z',
                  },
                ],
              },
            }
          : undefined) ??
        (call.method === 'PATCH'
          ? {
              status: 200,
              body: {
                ticket: {
                  ...assignedTicket,
                  status: 'resolved',
                  resolvedAt: '2026-11-20T10:02:00.000Z',
                  updatedAt: '2026-11-20T10:02:00.000Z',
                },
              },
            }
          : undefined)
    );
    renderApp('/chat');
    const sidebar = await screen.findByRole('complementary', {
      name: 'Assigned customer chats',
    });

    const conversationLink = await within(sidebar).findByRole('link', {
      name: 'VPN drops on home network',
    });
    expect(conversationLink).toHaveAttribute('href', `/chat/${conversationId}`);
    expect(
      screen.queryByLabelText('Describe your IT issue')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'New chat' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Chat actions for/ })
    ).not.toBeInTheDocument();

    fireEvent.click(conversationLink);
    expect(
      await screen.findByRole('article', { name: 'Ticket details' })
    ).toHaveTextContent('TCK-2010');
    expect(
      screen.getByRole('button', { name: 'Mark ticket as resolved' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: `Chat actions for ${assignedTicket.title}`,
      })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Mark ticket as resolved' })
    );
    await waitFor(() =>
      expect(calls.some((call) => call.method === 'PATCH')).toBe(true)
    );
    expect(calls.find((call) => call.method === 'PATCH')?.path).toBe(
      '/api/tickets/t-assigned'
    );
    expect(await screen.findByText('Ticket resolved.')).toBeInTheDocument();
    fireEvent.click(
      await within(sidebar).findByRole('button', {
        name: `Chat actions for ${assignedTicket.title}`,
      })
    );
    expect(
      within(sidebar).getByRole('button', { name: 'Archive' })
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole('button', { name: 'Delete' })
    ).toBeInTheDocument();
    expect(
      within(sidebar).queryByRole('button', { name: 'Rename' })
    ).not.toBeInTheDocument();
  });

  it('shows a retryable error on timeout and retries the same text', async () => {
    let attempts = 0;
    const { calls } = mockApi(
      baseHandler((call) => {
        if (call.path !== '/api/chat/messages') return undefined;
        attempts += 1;
        return attempts === 1
          ? { status: 504, body: { error: 'slow', code: 'timeout' } }
          : {
              status: 201,
              body: messagePair('VPN keeps dropping', {
                outcome: 'answered',
                content: 'Reconnect using the approved client.',
              }),
            };
      })
    );
    renderApp('/chat');
    await ask('VPN keeps dropping');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The assistant took too long to respond.');
    expect(alert).toHaveTextContent('Your message was not lost.');
    expect(screen.getByText('VPN keeps dropping')).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByText('Reconnect using the approved client.')
    ).toBeInTheDocument();
    const sends = calls.filter((call) => call.path === '/api/chat/messages');
    expect(sends.map((call) => call.body)).toEqual([
      { content: 'VPN keeps dropping' },
      { content: 'VPN keeps dropping' },
    ]);
  });

  it('shows server validation errors without retry', async () => {
    mockApi(
      baseHandler((call) =>
        call.path === '/api/chat/messages'
          ? {
              status: 400,
              body: {
                error: 'Keep messages under 2,000 characters.',
                code: 'validation_error',
              },
            }
          : undefined
      )
    );
    renderApp('/chat');
    await ask('hello');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Keep messages under 2,000 characters.');
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('treats an unknown outcome as an error instead of success', async () => {
    mockApi(
      baseHandler((call) =>
        call.path === '/api/chat/messages'
          ? {
              status: 201,
              body: messagePair('hi', {
                outcome: 'action_done',
                content: 'Done!',
              }),
            }
          : undefined
      )
    );
    renderApp('/chat');
    await ask('hi');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't read the assistant's reply."
    );
    expect(screen.queryByText('Done!')).toBeNull();
  });

  it('returns to sign-in when the session expires mid-chat', async () => {
    mockApi(
      baseHandler((call) =>
        call.path === '/api/chat/messages'
          ? { status: 401, body: { error: 'expired', code: 'unauthorized' } }
          : undefined
      )
    );
    renderApp('/chat');
    await ask('hello');

    expect(
      await screen.findByText(
        'Your session expired. Sign in again to continue.'
      )
    ).toBeInTheDocument();
  });

  it('blocks duplicate submission while a request is pending', async () => {
    const pending = deferred<{ status: number; body: unknown }>();
    const { calls } = mockApi(
      baseHandler((call) =>
        call.path === '/api/chat/messages' ? pending.promise : undefined
      )
    );
    renderApp('/chat');
    const input = await screen.findByLabelText('Describe your IT issue');
    fireEvent.change(input, { target: { value: 'Printer offline' } });
    const send = screen.getByRole('button', { name: 'Send' });
    fireEvent.click(send);
    fireEvent.click(send);
    fireEvent.keyDown(input, { key: 'Enter' });

    // Shown in the typing indicator and announced by the status region.
    expect(
      await screen.findAllByText('Checking approved IT procedures…')
    ).not.toHaveLength(0);
    // aria-disabled (not disabled) so the focused button keeps focus.
    expect(screen.getByRole('button', { name: 'Sending…' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(input).not.toBeDisabled();

    pending.resolve({
      status: 201,
      body: messagePair('Printer offline', {
        outcome: 'answered',
        content: 'Restart the print spooler.',
      }),
    });
    await screen.findByText('Restart the print spooler.');
    expect(
      calls.filter((call) => call.path === '/api/chat/messages')
    ).toHaveLength(1);
  });

  it('validates empty input and warns about secrets before sending', async () => {
    const { calls } = mockApi(baseHandler(() => undefined));
    renderApp('/chat');
    await ask('   ');
    expect(
      await screen.findByText('Type a question first.')
    ).toBeInTheDocument();

    await ask('my password is Winter2026!');
    expect(
      await screen.findByText(/This looks like a password or secret code/)
    ).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/api/chat/messages')).toBe(
      false
    );
  });

  it('loads prior conversation history in order', async () => {
    mockApi(
      baseHandler((call) =>
        call.path === '/api/conversations/c-9/messages'
          ? {
              status: 200,
              body: {
                conversation: { id: 'c-9', title: 'Old' },
                messages: [
                  messagePair('Earlier question', {
                    outcome: 'answered',
                    content: 'Earlier answer',
                    conversationId: 'c-9',
                  }).userMessage,
                  messagePair('Earlier question', {
                    outcome: 'answered',
                    content: 'Earlier answer',
                    conversationId: 'c-9',
                  }).message,
                ],
              },
            }
          : undefined
      )
    );
    renderApp('/chat/c-9');

    await waitFor(() =>
      expect(screen.getByText('Earlier answer')).toBeInTheDocument()
    );
    expect(screen.getByText('Earlier question')).toBeInTheDocument();
  });
});
