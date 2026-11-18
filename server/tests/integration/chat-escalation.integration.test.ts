import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionRepository } from '../../src/features/actions/index.js';
import { answerKnowledgeQuestion } from '../../src/features/chat/index.js';
import {
  bearer,
  createTestApp,
  NO_PROFILE_TOKEN,
  users,
} from '../helpers/auth.fixtures.js';

/**
 * Integration of the chat UI with the action and ticket APIs: escalation
 * from a conversation, ticket-to-conversation links, and the error shape the
 * client relies on.
 */
function fakeActions(): ActionRepository & {
  escalateToHuman: ReturnType<typeof vi.fn>;
  createTicket: ReturnType<typeof vi.fn>;
} {
  return {
    createTicket: vi.fn(async () => ({
      ticketId: randomUUID(),
      status: 'open',
    })),
    escalateToHuman: vi.fn(async () => ({
      ticketId: '55555555-5555-4555-8555-555555555555',
      status: 'escalated',
      queue: 'IT-agents',
    })),
    recordTestNotification: vi.fn(async () => ({
      runId: randomUUID(),
      status: 'success',
    })),
  };
}

const escalation = (conversationId?: string) => ({
  proposal: {
    intent: 'escalate_to_human',
    confidence: 1,
    reason: 'The employee asked for a person after an uncertain answer.',
    arguments: {
      title: 'Printer shows offline',
      summary: 'Asked: printer shows offline. Assistant had no procedure.',
      reason: 'low_confidence',
    },
  },
  ...(conversationId ? { context: { conversation_id: conversationId } } : {}),
});

describe('chat escalation through /api/actions/execute', () => {
  let actions: ReturnType<typeof fakeActions>;
  let setup: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    actions = fakeActions();
    setup = createTestApp({ actions });
  });

  it('passes the conversation id to the repository (was dropped before)', async () => {
    const conversation = await setup.conversations.create({
      requesterId: users.dana.id,
      title: 'Printer',
    });

    const response = await request(setup.app)
      .post('/api/actions/execute')
      .set('Authorization', bearer('dana'))
      .set('X-Action-Confirmed', 'escalate_to_human')
      .set('Idempotency-Key', 'escalate-1')
      .send(escalation(conversation.id));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'success',
      ticket_id: '55555555-5555-4555-8555-555555555555',
      queue: 'IT-agents',
    });
    expect(actions.escalateToHuman).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: users.dana.id,
        conversationId: conversation.id,
        idempotencyKey: 'escalate-1',
      })
    );
    const call = actions.escalateToHuman.mock.calls[0]![0] as object;
    expect(call).not.toHaveProperty('conversation_id');
  });

  it('uses the app session verifier, so tokens without a profile are rejected', async () => {
    const response = await request(setup.app)
      .post('/api/actions/execute')
      .set('Authorization', `Bearer ${NO_PROFILE_TOKEN}`)
      .set('X-Action-Confirmed', 'escalate_to_human')
      .set('Idempotency-Key', 'escalate-2')
      .send(escalation());

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('unauthorized');
    expect(actions.escalateToHuman).not.toHaveBeenCalled();
  });

  it('returns the API error shape with a stable code', async () => {
    const unconfirmed = await request(setup.app)
      .post('/api/actions/execute')
      .set('Authorization', bearer('dana'))
      .set('Idempotency-Key', 'escalate-3')
      .send(escalation());
    expect(unconfirmed.status).toBe(409);
    expect(unconfirmed.body).toMatchObject({
      error: 'Explicit confirmation is required.',
      code: 'confirmation_required',
    });

    const invalid = await request(setup.app)
      .post('/api/actions/execute')
      .set('Authorization', bearer('dana'))
      .send({ proposal: { intent: 'delete_everything' } });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('validation_error');

    const missing = await request(setup.app)
      .post('/api/actions/execute')
      .set('Authorization', bearer('dana'))
      .send({
        proposal: {
          intent: 'escalate_to_human',
          confidence: 1,
          reason: 'Missing summary.',
          arguments: { title: 'Printer', reason: 'low_confidence' },
        },
      });
    expect(missing.status).toBe(422);
    expect(missing.body).toMatchObject({
      code: 'needs_clarification',
      missing_fields: ['summary'],
    });
    expect(typeof missing.body.error).toBe('string');
    expect(actions.escalateToHuman).not.toHaveBeenCalled();
  });

  it('returns a coded 413 for oversized bodies', async () => {
    const response = await request(setup.app)
      .post('/api/actions/execute')
      .set('Authorization', bearer('dana'))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ proposal: 'x'.repeat(200_000) }));
    expect(response.status).toBe(413);
    expect(response.body.code).toBe('payload_too_large');
  });
});

describe('tickets linked to a chat conversation', () => {
  let setup: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    setup = createTestApp({ actions: fakeActions() });
  });

  const create = (user: 'dana' | 'sam', conversationId: unknown) =>
    request(setup.app)
      .post('/api/tickets')
      .set('Authorization', bearer(user))
      .set('Idempotency-Key', randomUUID())
      .send({
        title: 'Printer offline',
        description: 'Reported in chat.',
        conversationId,
      });

  it('links a ticket to the requester’s own conversation', async () => {
    const conversation = await setup.conversations.create({
      requesterId: users.dana.id,
      title: 'Printer',
    });
    const response = await create('dana', conversation.id);
    expect(response.status).toBe(201);
    expect(response.body.ticket.conversationId).toBe(conversation.id);
  });

  it('rejects another user’s conversation and malformed ids', async () => {
    const conversation = await setup.conversations.create({
      requesterId: users.dana.id,
      title: 'Printer',
    });
    const foreign = await create('sam', conversation.id);
    expect(foreign.status).toBe(400);
    expect(foreign.body.code).toBe('validation_error');

    const malformed = await create('dana', 'not-a-uuid');
    expect(malformed.status).toBe(400);
  });
});

describe('malformed ids return 404 instead of a database 503', () => {
  it('ticket detail, ticket update, and conversation history', async () => {
    const { app } = createTestApp({ actions: fakeActions() });

    const detail = await request(app)
      .get('/api/tickets/not-a-uuid')
      .set('Authorization', bearer('lee'));
    expect(detail.status).toBe(404);

    const update = await request(app)
      .patch('/api/tickets/not-a-uuid')
      .set('Authorization', bearer('lee'))
      .send({ status: 'open' });
    expect(update.status).toBe(404);

    const history = await request(app)
      .get('/api/conversations/not-a-uuid/messages')
      .set('Authorization', bearer('dana'));
    expect(history.status).toBe(404);
  });
});

describe('out-of-scope filter', () => {
  it('does not treat words containing "hr" as HR questions', () => {
    expect(
      answerKnowledgeQuestion('How do I reset my password through the portal?')
        .status
    ).not.toBe('insufficient_context');
  });

  it('still declines genuine HR and payroll questions', () => {
    expect(
      answerKnowledgeQuestion('Who do I ask in HR about leave?').status
    ).toBe('insufficient_context');
    expect(answerKnowledgeQuestion('My payroll slip is wrong').status).toBe(
      'insufficient_context'
    );
  });
});
