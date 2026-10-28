import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';

describe('chat answer endpoint', () => {
  it('returns grounded guidance for an approved support question', async () => {
    const response = await request(app).post('/api/chat/answer').send({
      question: 'How do I reset my MFA after losing my phone?',
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('answered');
    expect(response.body.sources.length).toBeGreaterThan(0);
    expect(response.body.answer).toContain('approved');
  });

  it('returns an insufficient context response for an unsupported question', async () => {
    const response = await request(app).post('/api/chat/answer').send({
      question: 'How do I fix my payroll account in the main finance system?',
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('insufficient_context');
    expect(response.body.answer).toContain('could not find enough approved');
  });
});
