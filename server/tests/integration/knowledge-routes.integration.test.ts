import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp, bearer } from '../helpers/auth.fixtures.js';

describe('knowledge search endpoint', () => {
  it('requires an authenticated user', async () => {
    const { app } = createTestApp({
      knowledge: { search: vi.fn(async () => []) },
    });

    const response = await request(app).get('/api/knowledge/search?q=VPN');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('unauthorized');
  });

  it.each([
    ['missing query', '/api/knowledge/search'],
    ['empty query', '/api/knowledge/search?q=%20%20'],
    ['oversized query', `/api/knowledge/search?q=${'x'.repeat(1001)}`],
  ])('rejects %s with a validation response', async (_label, path) => {
    const search = vi.fn(async () => []);
    const { app } = createTestApp({ knowledge: { search } });

    const response = await request(app)
      .get(path)
      .set('Authorization', bearer('dana'));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
    expect(search).not.toHaveBeenCalled();
  });

  it('returns a stable error without leaking provider details', async () => {
    const search = vi
      .fn()
      .mockRejectedValue(new Error('provider token and database details'));
    const { app } = createTestApp({ knowledge: { search } });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app)
      .get('/api/knowledge/search?q=VPN')
      .set('Authorization', bearer('dana'));

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: 'Knowledge search is temporarily unavailable.',
      code: 'service_unavailable',
    });
    expect(JSON.stringify(response.body)).not.toContain('provider token');
    expect(errorSpy).toHaveBeenCalledWith('Knowledge search failed.');
    errorSpy.mockRestore();
  });

  it('trims and forwards the validated query', async () => {
    const search = vi.fn(async () => []);
    const { app } = createTestApp({ knowledge: { search } });

    const response = await request(app)
      .get('/api/knowledge/search?q=%20VPN%20')
      .set('Authorization', bearer('dana'));

    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith('VPN');
  });
});
