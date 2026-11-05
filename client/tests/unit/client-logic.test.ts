import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateLogin } from '../../src/features/auth';
import {
  canSend,
  chatReducer,
  initialChatState,
  looksLikeSecret,
} from '../../src/features/chat';
import {
  filterQueue,
  defaultFilters,
  type Ticket,
} from '../../src/features/tickets';
import { ApiError, apiFetch, kindForStatus } from '../../src/shared/api/http';

describe('chatReducer', () => {
  const response = {
    conversationId: 'c1',
    conversation: { id: 'c1', title: 't', createdAt: '', updatedAt: '' },
    userMessage: {
      id: 'u',
      conversationId: 'c1',
      senderType: 'user' as const,
      content: 'q',
      outcome: null,
      sourceRefs: [],
      createdAt: '1',
    },
    message: {
      id: 'a',
      conversationId: 'c1',
      senderType: 'assistant' as const,
      content: 'a',
      outcome: 'answered' as const,
      sourceRefs: [],
      createdAt: '2',
    },
    outcome: 'answered' as const,
  };

  it('ignores a second send while one is pending', () => {
    const sending = chatReducer(initialChatState, {
      type: 'sendStarted',
      content: 'first',
    });
    expect(canSend(sending)).toBe(false);
    expect(
      chatReducer(sending, { type: 'sendStarted', content: 'second' })
    ).toBe(sending);
  });

  it('appends both messages on success and keeps failed text for retry', () => {
    const sending = chatReducer(initialChatState, {
      type: 'sendStarted',
      content: 'q',
    });
    const done = chatReducer(sending, { type: 'sendSucceeded', response });
    expect(done.messages.map((m) => m.id)).toEqual(['u', 'a']);
    expect(done.conversationId).toBe('c1');
    expect(done.pendingContent).toBeNull();

    const failed = chatReducer(
      chatReducer(done, { type: 'sendStarted', content: 'again' }),
      { type: 'sendFailed', error: new ApiError('timeout', 'slow') }
    );
    expect(failed.status).toBe('sendError');
    expect(failed.pendingContent).toBe('again');
    expect(canSend(failed)).toBe(true);
  });

  it('drops stale history responses for another conversation', () => {
    const loading = chatReducer(initialChatState, {
      type: 'historyRequested',
      conversationId: 'c2',
    });
    expect(
      chatReducer(loading, {
        type: 'historyLoaded',
        conversationId: 'c1',
        messages: [],
      })
    ).toBe(loading);
  });
});

describe('looksLikeSecret', () => {
  it.each([
    'my password is Winter2026!',
    'password: hunter22',
    'the OTP is 482913',
    'key AIzaSyA1234567890abcdefghijklmnop',
    'token eyJhbGciOiJIUzI1NiIs.eyJzdWIiOiIxMjM0NTY3.SflKxwRJSMeKKF2QT4fw',
  ])('flags %s', (text) => {
    expect(looksLikeSecret(text)).toBe(true);
  });

  it.each([
    'I forgot my password',
    'How do I reset my MFA?',
    'Ticket 2049 is still open',
  ])('allows %s', (text) => {
    expect(looksLikeSecret(text)).toBe(false);
  });
});

describe('validateLogin', () => {
  it('requires a valid email and password', () => {
    expect(validateLogin('', '')).toEqual({
      email: 'Enter your work email.',
      password: 'Enter your password.',
    });
    expect(validateLogin('nope', 'x').email).toBe(
      'Enter a valid email address.'
    );
    expect(validateLogin('dana@example.test', 'x')).toEqual({});
  });
});

describe('filterQueue', () => {
  const ticket = (overrides: Partial<Ticket>): Ticket =>
    ({
      id: 'x',
      reference: 'TCK-1',
      title: 'T',
      requesterName: 'R',
      category: 'c',
      priority: 'medium',
      status: 'open',
      assignedTo: null,
      isEscalated: false,
      createdAt: '2026-11-01T00:00:00Z',
      ...overrides,
    }) as Ticket;

  it('hides resolved tickets by default and sorts by escalation/priority/age', () => {
    const result = filterQueue(
      [
        ticket({
          id: 'old-low',
          priority: 'low',
          createdAt: '2026-10-01T00:00:00Z',
        }),
        ticket({ id: 'resolved', status: 'resolved' }),
        ticket({ id: 'urgent', priority: 'urgent' }),
        ticket({ id: 'esc', isEscalated: true, priority: 'low' }),
        ticket({ id: 'medium-new', createdAt: '2026-11-05T00:00:00Z' }),
        ticket({ id: 'medium-old', createdAt: '2026-11-02T00:00:00Z' }),
      ],
      defaultFilters
    );
    expect(result.map((t) => t.id)).toEqual([
      'esc',
      'urgent',
      'medium-old',
      'medium-new',
      'old-low',
    ]);
  });
});

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('maps HTTP status codes to error kinds', () => {
    expect(kindForStatus(401)).toBe('unauthorized');
    expect(kindForStatus(403)).toBe('forbidden');
    expect(kindForStatus(409)).toBe('conflict');
    expect(kindForStatus(422)).toBe('validation');
    expect(kindForStatus(504)).toBe('timeout');
    expect(kindForStatus(503)).toBe('server');
  });

  it('hides server error details for 5xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'relation "tickets" does not exist' }),
      })
    );
    await expect(apiFetch('/api/x')).rejects.toMatchObject({
      kind: 'server',
      message: 'Something went wrong on our side. Please try again.',
    });
  });

  it('reports network failures and timeouts as distinct kinds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ kind: 'network' });

    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            );
          })
      )
    );
    await expect(apiFetch('/api/x', { timeoutMs: 5 })).rejects.toMatchObject({
      kind: 'timeout',
    });
  });
});
