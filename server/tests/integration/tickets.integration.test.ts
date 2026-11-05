import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createTestApp, users } from '../helpers/auth.fixtures.js';

describe('ticket endpoints', () => {
  let app: ReturnType<typeof createTestApp>['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  const createTicket = (user: 'dana' | 'sam' = 'dana', body = {}) =>
    request(app)
      .post('/api/tickets')
      .set('Authorization', bearer(user))
      .send({
        title: 'Cannot sign in to VPN',
        description: 'My VPN connection fails after multi-factor prompt.',
        category: 'network',
        priority: 'high',
        ...body,
      });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/tickets');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('unauthorized');
  });

  it('creates a ticket with server-derived requester identity', async () => {
    const response = await createTicket('dana', {
      requesterId: users.sam.id,
      requesterName: 'Spoofed Name',
    });

    expect(response.status).toBe(201);
    expect(response.body.ticket).toMatchObject({
      title: 'Cannot sign in to VPN',
      status: 'new',
      requesterId: users.dana.id,
      requesterName: 'Dana Cruz',
      assignedTo: null,
    });
    expect(response.body.ticket.reference).toMatch(/^TCK-\d+$/);
  });

  it('ignores spoofed identity headers', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer('dana'))
      .set('x-user-id', users.lee.id)
      .set('x-user-role', 'admin')
      .send({ title: 'MFA reset', description: 'Need new phone.' });

    expect(response.body.ticket.requesterId).toBe(users.dana.id);
  });

  it('rejects invalid ticket input', async () => {
    const response = await createTicket('dana', { title: '', description: '' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
    expect(response.body.error).toContain('required');
  });

  it('scopes employee reads to their own tickets', async () => {
    const danaTicket = (await createTicket('dana')).body.ticket;
    await createTicket('sam');

    const danaList = await request(app)
      .get('/api/tickets')
      .set('Authorization', bearer('dana'));
    expect(danaList.body.tickets).toHaveLength(1);

    const samRead = await request(app)
      .get(`/api/tickets/${danaTicket.id}`)
      .set('Authorization', bearer('sam'));
    expect(samRead.status).toBe(404);

    const agentList = await request(app)
      .get('/api/tickets')
      .set('Authorization', bearer('lee'));
    expect(agentList.body.tickets).toHaveLength(2);
  });

  it('forbids employees from updating tickets', async () => {
    const ticket = (await createTicket('dana')).body.ticket;

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('dana'))
      .send({ status: 'open' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('forbidden');
  });

  it('lets agents update status and assignment and records audit', async () => {
    const ticket = (await createTicket('dana')).body.ticket;

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ status: 'in_progress', assigneeId: users.lee.id });

    expect(response.status).toBe(200);
    expect(response.body.ticket).toMatchObject({
      status: 'in_progress',
      assignedTo: users.lee.id,
      assigneeName: 'Lee Santos',
      requesterId: users.dana.id,
    });

    const detail = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'));
    expect(
      detail.body.audit.map((entry: { action: string }) => entry.action)
    ).toEqual(['ticket.created', 'ticket.status_updated']);
  });

  it('enforces legal status transitions', async () => {
    const ticket = (await createTicket('dana')).body.ticket;

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ status: 'closed' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('not allowed');
  });

  it('rejects assignment to an employee', async () => {
    const ticket = (await createTicket('dana')).body.ticket;

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ assigneeId: users.sam.id });

    expect(response.status).toBe(400);
  });

  it('returns 409 when the ticket changed since the caller loaded it', async () => {
    const ticket = (await createTicket('dana')).body.ticket;

    await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ status: 'open', expectedUpdatedAt: ticket.updatedAt });

    const stale = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ status: 'in_progress', expectedUpdatedAt: ticket.updatedAt });

    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('conflict');
  });
});
