import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  parseDateRange,
  summarizeTickets,
} from '../../src/features/analytics/index.js';
import {
  createRequireAuth,
  readBearerToken,
  requireRole,
  type AuthVerifier,
} from '../../src/features/auth/index.js';
import {
  conversationTitle,
  toChatOutcome,
  validateMessageContent,
  withTimeout,
} from '../../src/features/chat/index.js';
import {
  InMemoryTicketRepository,
  TicketService,
  type TicketRecord,
} from '../../src/features/tickets/index.js';
import { InMemoryProfileDirectory, users } from '../helpers/auth.fixtures.js';

function mockResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response;
}

describe('auth middleware', () => {
  it('parses bearer tokens strictly', () => {
    expect(readBearerToken('Bearer abc.def')).toBe('abc.def');
    expect(readBearerToken('bearer abc')).toBe('abc');
    expect(readBearerToken('Basic abc')).toBeNull();
    expect(readBearerToken(undefined)).toBeNull();
  });

  it.each([
    ['missing token', undefined, 401],
    ['invalid token', 'Bearer bad', 401],
    ['no profile', 'Bearer none', 403],
  ])('rejects %s', async (_label, header, status) => {
    const verifier: AuthVerifier = {
      verify: async (token) =>
        token === 'none' ? { status: 'no_profile' } : { status: 'invalid' },
    };
    const response = mockResponse();
    const next = vi.fn();
    await createRequireAuth(verifier)(
      { headers: { authorization: header } } as Request,
      response as unknown as Response,
      next as NextFunction
    );
    expect(response.statusCode).toBe(status);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the verified context', async () => {
    const verifier: AuthVerifier = {
      verify: async () => ({
        status: 'ok',
        context: { userId: 'u1', role: 'agent', displayName: 'Agent' },
      }),
    };
    const request = { headers: { authorization: 'Bearer ok' } } as Request;
    const next = vi.fn();
    await createRequireAuth(verifier)(
      request,
      mockResponse() as unknown as Response,
      next as NextFunction
    );
    expect(next).toHaveBeenCalledOnce();
    expect(request.auth?.role).toBe('agent');
  });

  it('requireRole denies roles outside the allowlist', () => {
    const response = mockResponse();
    const next = vi.fn();
    requireRole('agent', 'admin')(
      {
        auth: { userId: 'u', role: 'employee', displayName: 'E' },
      } as Request,
      response as unknown as Response,
      next as NextFunction
    );
    expect(response.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('ticket service', () => {
  const employee = {
    userId: users.dana.id,
    role: 'employee' as const,
    displayName: 'Dana Cruz',
  };
  const agent = {
    userId: users.lee.id,
    role: 'agent' as const,
    displayName: 'Lee Santos',
  };
  const setup = () =>
    new TicketService(
      new InMemoryTicketRepository(),
      new InMemoryProfileDirectory()
    );

  it('keeps requester when assigning (regression: assignee overwrote requester)', async () => {
    const service = setup();
    const ticket = await service.create(
      { title: 'Laptop', description: 'Broken hinge' },
      employee
    );
    const updated = await service.update(
      ticket.id,
      { assigneeId: users.lee.id },
      agent
    );
    expect(updated.requesterId).toBe(users.dana.id);
    expect(updated.assignedTo).toBe(users.lee.id);
  });

  it('sets resolvedAt when resolving and clears unchanged updates', async () => {
    const service = setup();
    const ticket = await service.create(
      { title: 'Laptop', description: 'Broken hinge' },
      employee
    );
    await service.update(ticket.id, { status: 'open' }, agent);
    const resolved = await service.update(
      ticket.id,
      { status: 'resolved' },
      agent
    );
    expect(resolved.resolvedAt).not.toBeNull();

    const unchanged = await service.update(ticket.id, {}, agent);
    expect(unchanged.updatedAt).toBe(resolved.updatedAt);
  });

  it('rejects invalid priority and unknown status', async () => {
    const service = setup();
    await expect(
      service.create(
        { title: 'A', description: 'B', priority: 'critical' },
        employee
      )
    ).rejects.toThrow('priority');
    const ticket = await service.create(
      { title: 'A', description: 'B' },
      employee
    );
    await expect(
      service.update(ticket.id, { status: 'done' }, agent)
    ).rejects.toThrow('status must be one of');
  });
});

describe('chat helpers', () => {
  it('maps answer statuses to UI outcomes', () => {
    expect(toChatOutcome('answered')).toBe('answered');
    expect(toChatOutcome('insufficient_context')).toBe('escalation_suggested');
  });

  it('validates message content', () => {
    expect(validateMessageContent('  hi  ')).toBe('hi');
    expect(() => validateMessageContent('')).toThrow('Type a question first.');
    expect(() => validateMessageContent(42)).toThrow();
    expect(() => validateMessageContent('x'.repeat(2001))).toThrow('2,000');
  });

  it('builds a bounded single-line conversation title', () => {
    expect(conversationTitle('My\n  VPN drops')).toBe('My VPN drops');
    expect(conversationTitle('x'.repeat(200))).toHaveLength(80);
  });

  it('rejects slow work with a timeout error', async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 5)
    ).rejects.toMatchObject({ status: 504, code: 'timeout' });
    await expect(withTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
  });
});

describe('analytics', () => {
  const ticket = (overrides: Partial<TicketRecord>): TicketRecord => ({
    id: 't',
    reference: 'TCK-1',
    title: 'x',
    description: 'x',
    category: 'general',
    priority: 'medium',
    status: 'new',
    requesterId: 'r',
    requesterName: 'R',
    assignedTo: null,
    assigneeName: null,
    isEscalated: false,
    conversationId: null,
    escalationSummary: null,
    resolvedAt: null,
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    ...overrides,
  });

  it('computes documented metrics', () => {
    const range = parseDateRange({ from: '2026-11-01', to: '2026-11-30' });
    const summary = summarizeTickets(
      [
        ticket({ isEscalated: true, priority: 'high' }),
        ticket({ status: 'in_progress', assignedTo: 'a' }),
        ticket({
          status: 'resolved',
          resolvedAt: '2026-11-12T00:00:00.000Z',
        }),
        ticket({ createdAt: '2026-10-01T00:00:00.000Z' }),
      ],
      range
    );
    expect(summary).toMatchObject({
      totalTickets: 4,
      openEscalated: 1,
      openUnassigned: 2,
      createdInRange: 3,
      resolvedInRange: 1,
    });
    expect(summary.byStatus).toMatchObject({
      new: 2,
      in_progress: 1,
      resolved: 1,
    });
    expect(summary.openByPriority).toMatchObject({ high: 1, medium: 2 });
  });

  it('treats a date-only `to` as the whole day and defaults to 30 days', () => {
    const range = parseDateRange({ to: '2026-11-30' });
    expect(range.to.toISOString()).toBe('2026-11-30T23:59:59.999Z');
    expect(range.to.getTime() - range.from.getTime()).toBe(30 * 86_400_000);
    expect(() => parseDateRange({ from: 'nope' })).toThrow();
    expect(() =>
      parseDateRange({ from: '2024-01-01', to: '2026-01-01' })
    ).toThrow('366');
  });
});
