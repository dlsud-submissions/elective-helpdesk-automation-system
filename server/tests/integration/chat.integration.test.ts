import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ChatAnswer } from '../../src/features/chat/index.js';
import { bearer, createTestApp } from '../helpers/auth.fixtures.js';

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
