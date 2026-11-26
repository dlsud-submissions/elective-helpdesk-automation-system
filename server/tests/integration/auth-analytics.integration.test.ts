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
      email: 'lee@example.test',
      displayName: 'Lee Santos',
      role: 'agent',
      accountStatus: 'active',
      suspendedUntil: null,
      banReason: null,
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

  it('lists staff only for admins', async () => {
    const admin = await request(app)
      .get('/api/agents')
      .set('Authorization', bearer('ari'));
    expect(admin.status).toBe(200);
    expect(
      admin.body.agents.map((a: { role: string }) => a.role).sort()
    ).toEqual(['agent']);

    for (const user of ['lee', 'dana'] as const) {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', bearer(user));
      expect(response.status).toBe(403);
    }
  });
});

describe('GET /api/analytics/summary', () => {
  it('returns employee-owned metrics without admin-only values', async () => {
    const { app } = createTestApp();
    await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer('dana'))
      .set('Idempotency-Key', 'employee-dashboard-ticket')
      .send({ title: 'Private request', description: 'Details.' });
    const response = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', bearer('dana'));

    expect(response.status).toBe(200);
    expect(response.body.summary.totalTickets).toBe(1);
    expect(response.body.summary.assignedTickets).toBeUndefined();
    expect(response.body.summary.openUnassigned).toBeUndefined();
    expect(response.body.summary.openEscalated).toBeUndefined();
    expect(JSON.stringify(response.body.summary)).not.toContain(
      'Private request'
    );
  });

  it('returns agent-assigned metrics without admin-only values', async () => {
    const { app } = createTestApp();
    const assigned = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer('dana'))
      .set('Idempotency-Key', 'agent-dashboard-assigned')
      .send({ title: 'Assigned request', description: 'Details.' });
    await request(app)
      .patch(`/api/tickets/${assigned.body.ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ assigneeId: users.lee.id });
    await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer('dana'))
      .set('Idempotency-Key', 'agent-dashboard-unassigned')
      .send({ title: 'Unassigned request', description: 'Details.' });

    const response = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', bearer('lee'));

    expect(response.status).toBe(200);
    expect(response.body.summary.totalTickets).toBe(1);
    expect(response.body.summary.assignedTickets).toBeUndefined();
    expect(response.body.summary.openUnassigned).toBeUndefined();
    expect(response.body.summary.openEscalated).toBeUndefined();
    expect(JSON.stringify(response.body.summary)).not.toContain(
      'Unassigned request'
    );
  });

  it('returns admin aggregates including assigned tickets', async () => {
    const { app } = createTestApp();
    for (const [index, priority] of ['high', 'low'].entries()) {
      await request(app)
        .post('/api/tickets')
        .set('Authorization', bearer('dana'))
        .set('Idempotency-Key', `analytics-ticket-${index}`)
        .send({ title: 'Printer jam', description: 'Paper stuck.', priority });
    }

    const tickets = await request(app)
      .get('/api/tickets')
      .set('Authorization', bearer('ari'));
    await request(app)
      .patch(`/api/tickets/${tickets.body.tickets[0].id}`)
      .set('Authorization', bearer('ari'))
      .send({ assigneeId: users.lee.id });

    const response = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', bearer('ari'));

    expect(response.status).toBe(200);
    const { summary } = response.body;
    expect(summary).toMatchObject({
      totalTickets: 2,
      assignedTickets: 1,
      createdInRange: 2,
      resolvedInRange: 0,
      openUnassigned: 1,
      openEscalated: 0,
    });
    expect(summary.byStatus.pending).toBe(2);
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
