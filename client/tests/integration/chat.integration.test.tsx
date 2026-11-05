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
    expect(items).toEqual(['You', 'Assistant', 'You', 'Assistant']);
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
              ticket: { id: 't-1', reference: 'TCK-2001', status: 'new' },
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

    expect(
      await screen.findByText('Checking approved IT procedures…')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();

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
