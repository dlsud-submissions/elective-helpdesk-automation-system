import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  bearer,
  createTestApp,
  NO_PROFILE_TOKEN,
  users,
} from '../helpers/auth.fixtures.js';

describe('GET /api/me', () => {
  const { app } = createTestApp();

  it('returns the profile role from the profile directory', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', bearer('lee'));

    expect(response.status).toBe(200);
    expect(response.body.profile).toEqual({
      id: users.lee.id,
      displayName: 'Lee Santos',
      role: 'agent',
    });
  });

  it('returns 401 for a missing or invalid token', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
    const invalid = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(invalid.status).toBe(401);
    expect(invalid.body.code).toBe('unauthorized');
  });

  it('returns 403 profile_not_found for a user without a profile', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${NO_PROFILE_TOKEN}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('profile_not_found');
  });
});

describe('GET /api/agents', () => {
  const { app } = createTestApp();

  it('lists staff for agents and denies employees', async () => {
    const agent = await request(app)
      .get('/api/agents')
      .set('Authorization', bearer('lee'));
    expect(agent.status).toBe(200);
    expect(
      agent.body.agents.map((a: { role: string }) => a.role).sort()
    ).toEqual(['admin', 'agent']);

    const employee = await request(app)
      .get('/api/agents')
      .set('Authorization', bearer('dana'));
    expect(employee.status).toBe(403);
  });
});

describe('GET /api/analytics/summary', () => {
  it('denies employees', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', bearer('dana'));
    expect(response.status).toBe(403);
  });

  it('returns aggregate counts only for agents', async () => {
    const { app } = createTestApp();
    for (const priority of ['high', 'low']) {
      await request(app)
        .post('/api/tickets')
        .set('Authorization', bearer('dana'))
        .send({ title: 'Printer jam', description: 'Paper stuck.', priority });
    }

    const response = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', bearer('ari'));

    expect(response.status).toBe(200);
    const { summary } = response.body;
    expect(summary).toMatchObject({
      totalTickets: 2,
      createdInRange: 2,
      resolvedInRange: 0,
      openUnassigned: 2,
      openEscalated: 0,
    });
    expect(summary.byStatus.new).toBe(2);
    expect(summary.openByPriority).toMatchObject({ high: 1, low: 1 });
    expect(JSON.stringify(summary)).not.toContain('Printer jam');
  });

  it('validates the date range', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .get('/api/analytics/summary?from=2026-12-01&to=2026-11-01')
      .set('Authorization', bearer('lee'));
    expect(response.status).toBe(400);
  });
});
