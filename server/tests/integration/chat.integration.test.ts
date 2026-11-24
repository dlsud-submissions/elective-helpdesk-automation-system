import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ChatAnswer } from '../../src/features/chat/index.js';
import { bearer, createTestApp, users } from '../helpers/auth.fixtures.js';

describe('chat answer endpoint', () => {
  const { app } = createTestApp();

  it('requires authentication', async () => {
    const response = await request(app)
      .post('/api/chat/answer')
      .send({ question: 'How do I reset my MFA?' });
    expect(response.status).toBe(401);
  });

  it('returns grounded guidance for an approved support question', async () => {
    const response = await request(app)
      .post('/api/chat/answer')
      .set('Authorization', bearer('dana'))
      .send({ question: 'How do I reset my MFA after losing my phone?' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('answered');
    expect(response.body.sources.length).toBeGreaterThan(0);
    expect(response.body.answer).toContain('approved');
  });

  it('returns an insufficient context response for an unsupported question', async () => {
    const response = await request(app)
      .post('/api/chat/answer')
      .set('Authorization', bearer('dana'))
      .send({
        question: 'How do I fix my payroll account in the main finance system?',
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('insufficient_context');
    expect(response.body.answer).toContain('could not find enough approved');
  });
});

describe('chat messages and conversation history', () => {
  it('persists a cited answer and returns it in history', async () => {
    const { app } = createTestApp();

    const sent = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'How do I reset my MFA after losing my phone?' });

    expect(sent.status).toBe(201);
    expect(sent.body.outcome).toBe('answered');
    expect(sent.body.message.senderType).toBe('assistant');
    expect(sent.body.message.sourceRefs.length).toBeGreaterThan(0);
    expect(sent.body.message.sourceRefs[0]).toMatchObject({
      articleId: expect.any(String),
      title: expect.any(String),
    });

    const followUp = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({
        conversationId: sent.body.conversationId,
        content: 'What about a locked password?',
      });
    expect(followUp.body.conversationId).toBe(sent.body.conversationId);

    const history = await request(app)
      .get(`/api/conversations/${sent.body.conversationId}/messages`)
      .set('Authorization', bearer('dana'));
    expect(history.status).toBe(200);
    expect(
      history.body.messages.map((m: { senderType: string }) => m.senderType)
    ).toEqual(['user', 'assistant', 'user', 'assistant']);

    const list = await request(app)
      .get('/api/conversations')
      .set('Authorization', bearer('dana'));
    expect(list.body.conversations).toHaveLength(1);
  });

  it('maps insufficient context to escalation_suggested without sources', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'Can you change my payroll bank details?' });

    expect(response.body.outcome).toBe('escalation_suggested');
    expect(response.body.message.sourceRefs).toEqual([]);
  });

  it("hides another user's conversation", async () => {
    const { app } = createTestApp();
    const sent = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'How do I reset my password?' });

    const read = await request(app)
      .get(`/api/conversations/${sent.body.conversationId}/messages`)
      .set('Authorization', bearer('sam'));
    expect(read.status).toBe(404);

    const write = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('sam'))
      .send({
        conversationId: sent.body.conversationId,
        content: 'Hello',
      });
    expect(write.status).toBe(404);
  });

  it('limits agent chat access to conversations linked to assigned tickets', async () => {
    const { app } = createTestApp();
    const assignedChat = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'My VPN keeps disconnecting.' });
    const unrelatedChat = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('sam'))
      .send({ content: 'My laptop will not start.' });
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer('dana'))
      .set('Idempotency-Key', 'assigned-chat-ticket')
      .send({
        title: 'VPN disconnects',
        description: 'The VPN drops frequently.',
        conversationId: assignedChat.body.conversationId,
      });
    await request(app)
      .patch(`/api/tickets/${ticket.body.ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ assigneeId: '22222222-2222-4222-8222-222222222222' });

    const agentList = await request(app)
      .get('/api/conversations')
      .set('Authorization', bearer('lee'));
    expect(agentList.status).toBe(200);
    expect(
      agentList.body.conversations.map((item: { id: string }) => item.id)
    ).toEqual([assignedChat.body.conversationId]);

    const assignedHistory = await request(app)
      .get(`/api/conversations/${assignedChat.body.conversationId}/messages`)
      .set('Authorization', bearer('lee'));
    const unrelatedHistory = await request(app)
      .get(`/api/conversations/${unrelatedChat.body.conversationId}/messages`)
      .set('Authorization', bearer('lee'));
    const agentSend = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('lee'))
      .send({ content: 'Starting a new chat.' });
    const adminList = await request(app)
      .get('/api/conversations')
      .set('Authorization', bearer('ari'));
    const adminSend = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('ari'))
      .send({ content: 'Starting a new chat.' });

    expect(assignedHistory.status).toBe(200);
    expect(assignedHistory.body.messages.at(-1).senderType).toBe('system');
    expect(assignedHistory.body.messages.at(-1).content).toContain(
      ticket.body.ticket.reference
    );
    expect(assignedHistory.body.messages.at(-1).content).toContain(
      'The VPN drops frequently.'
    );
    expect(unrelatedHistory.status).toBe(404);
    expect(agentSend.status).toBe(403);
    expect(adminList.status).toBe(403);
    expect(adminSend.status).toBe(403);
  });

  it('allows agents to archive or delete assigned chats only after resolution', async () => {
    const { app } = createTestApp();
    const firstChat = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'VPN ticket to archive.' });
    const secondChat = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'VPN ticket to delete.' });

    const firstTicket = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer('dana'))
      .set('Idempotency-Key', 'archive-chat-ticket')
      .send({
        title: 'Archive test',
        description: 'Archive test details.',
        conversationId: firstChat.body.conversationId,
      });
    const secondTicket = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer('dana'))
      .set('Idempotency-Key', 'delete-chat-ticket')
      .send({
        title: 'Delete test',
        description: 'Delete test details.',
        conversationId: secondChat.body.conversationId,
      });

    const assigned = await Promise.all(
      [firstTicket.body.ticket, secondTicket.body.ticket].map((ticket) =>
        request(app)
          .patch(`/api/tickets/${ticket.id}`)
          .set('Authorization', bearer('ari'))
          .send({ assigneeId: users.lee.id })
      )
    );

    const prematureArchive = await request(app)
      .patch(`/api/conversations/${firstChat.body.conversationId}`)
      .set('Authorization', bearer('lee'))
      .send({ archived: true });
    const prematureDelete = await request(app)
      .delete(`/api/conversations/${secondChat.body.conversationId}`)
      .set('Authorization', bearer('lee'));
    expect(prematureArchive.status).toBe(403);
    expect(prematureDelete.status).toBe(403);

    await Promise.all(
      assigned.map((response) =>
        request(app)
          .patch(`/api/tickets/${response.body.ticket.id}`)
          .set('Authorization', bearer('lee'))
          .send({ status: 'resolved' })
      )
    );

    const archived = await request(app)
      .patch(`/api/conversations/${firstChat.body.conversationId}`)
      .set('Authorization', bearer('lee'))
      .send({ archived: true });
    const deleted = await request(app)
      .delete(`/api/conversations/${secondChat.body.conversationId}`)
      .set('Authorization', bearer('lee'));

    expect(archived.status).toBe(200);
    expect(deleted.status).toBe(204);
  });

  it('rejects empty and oversized messages', async () => {
    const { app } = createTestApp();
    const empty = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: '   ' });
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('validation_error');

    const oversized = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'x'.repeat(2001) });
    expect(oversized.status).toBe(400);
  });

  it('rejects unexpected fields and malformed conversation IDs', async () => {
    const { app, conversations } = createTestApp();
    const unexpected = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'How do I reset my password?', role: 'admin' });
    const malformedId = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({
        content: 'How do I reset my password?',
        conversationId: 'not-a-uuid',
      });

    expect(unexpected.status).toBe(400);
    expect(unexpected.body.code).toBe('validation_error');
    expect(malformedId.status).toBe(400);
    expect(malformedId.body.code).toBe('validation_error');
    expect(
      await conversations.listByRequester(
        '11111111-1111-4111-8111-111111111111'
      )
    ).toEqual([]);
  });

  it('returns 504 on answer timeout and stores nothing', async () => {
    const { app } = createTestApp({
      answer: () => new Promise<ChatAnswer>(() => undefined),
      answerTimeoutMs: 20,
    });

    const response = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'How do I reset my password?' });
    expect(response.status).toBe(504);
    expect(response.body.code).toBe('timeout');

    const list = await request(app)
      .get('/api/conversations')
      .set('Authorization', bearer('dana'));
    expect(list.body.conversations).toHaveLength(0);
  });

  it('returns a controlled 503 when the answer dependency fails', async () => {
    const { app } = createTestApp({
      answer: () => {
        throw new Error('Gemini HTTP 429 quota exceeded: internal detail');
      },
    });

    const response = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', bearer('dana'))
      .send({ content: 'How do I reset my password?' });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('answer_unavailable');
    expect(JSON.stringify(response.body)).not.toContain('internal detail');
  });
});
