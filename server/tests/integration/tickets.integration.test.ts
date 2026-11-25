import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createTestApp, users } from '../helpers/auth.fixtures.js';

describe('ticket endpoints', () => {
  let app: ReturnType<typeof createTestApp>['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  const createTicket = (
    user: 'dana' | 'sam' = 'dana',
    body = {},
    idempotencyKey: string = randomUUID()
  ) =>
    request(app)
      .post('/api/tickets')
      .set('Authorization', bearer(user))
      .set('Idempotency-Key', idempotencyKey)
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
      status: 'pending',
      isOpen: true,
      requesterId: users.dana.id,
      requesterName: 'Dana Cruz',
      assignedTo: null,
    });
    expect(response.body.ticket.reference).toMatch(/^TCK-\d+$/);
  });

  it('prevents agents and admins from creating tickets', async () => {
    for (const user of ['lee', 'ari'] as const) {
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', bearer(user))
        .set('Idempotency-Key', randomUUID())
        .send({ title: 'VPN issue', description: 'Connection fails.' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('forbidden');
    }
  });

  it('ignores spoofed identity headers', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer('dana'))
      .set('Idempotency-Key', randomUUID())
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

  it('requires an idempotency key and returns the same ticket on retry', async () => {
    const missingKey = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer('dana'))
      .send({ title: 'VPN', description: 'Connection fails.' });
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error).toContain('Idempotency-Key');

    const first = await createTicket('dana', {}, 'ticket-retry-001');
    const retry = await createTicket('dana', {}, 'ticket-retry-001');
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body.ticket.id).toBe(first.body.ticket.id);

    const list = await request(app)
      .get('/api/tickets')
      .set('Authorization', bearer('dana'));
    expect(list.body.tickets).toHaveLength(1);
    expect(
      (
        await request(app)
          .get(`/api/tickets/${first.body.ticket.id}`)
          .set('Authorization', bearer('ari'))
      ).body.audit
    ).toHaveLength(1);
  });

  it('rejects unsupported ticket creation fields', async () => {
    const response = await createTicket('dana', { isAdmin: true });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
    expect(response.body.error).toContain('unexpected field');
    const list = await request(app)
      .get('/api/tickets')
      .set('Authorization', bearer('dana'));
    expect(list.body.tickets).toHaveLength(0);
  });

  it('rejects unexpected ticket mutation fields instead of silently ignoring them', async () => {
    const ticket = (await createTicket()).body.ticket;
    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ status: 'open', admin: true });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
    expect(response.body.error).toContain('unexpected field');
    expect(
      (
        await request(app)
          .get(`/api/tickets/${ticket.id}`)
          .set('Authorization', bearer('ari'))
      ).body.ticket.status
    ).toBe('pending');
  });

  it('scopes employee reads to their own tickets', async () => {
    const danaTicket = (await createTicket('dana')).body.ticket;
    const samTicket = (await createTicket('sam')).body.ticket;

    const danaList = await request(app)
      .get('/api/tickets')
      .set('Authorization', bearer('dana'));
    expect(danaList.body.tickets).toHaveLength(1);

    const samRead = await request(app)
      .get(`/api/tickets/${danaTicket.id}`)
      .set('Authorization', bearer('sam'));
    expect(samRead.status).toBe(404);

    const unassignedAgentRead = await request(app)
      .get(`/api/tickets/${samTicket.id}`)
      .set('Authorization', bearer('lee'));
    expect(unassignedAgentRead.status).toBe(404);

    await request(app)
      .patch(`/api/tickets/${danaTicket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ assigneeId: users.lee.id });
    const agentList = await request(app)
      .get('/api/tickets')
      .set('Authorization', bearer('lee'));
    expect(agentList.body.tickets).toHaveLength(1);
    expect(agentList.body.tickets[0].id).toBe(danaTicket.id);
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

  it('lets only the requester confirm a ticket as resolved and closed', async () => {
    const ticket = (await createTicket('dana')).body.ticket;

    const confirmed = await request(app)
      .post(`/api/tickets/${ticket.id}/confirm-resolution`)
      .set('Authorization', bearer('dana'))
      .send({});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.ticket).toMatchObject({
      status: 'resolved',
      isOpen: false,
      requesterId: users.dana.id,
    });

    const repeated = await request(app)
      .post(`/api/tickets/${ticket.id}/confirm-resolution`)
      .set('Authorization', bearer('dana'))
      .send({});
    expect(repeated.status).toBe(200);

    const otherEmployee = await request(app)
      .post(`/api/tickets/${ticket.id}/confirm-resolution`)
      .set('Authorization', bearer('sam'))
      .send({});
    const agent = await request(app)
      .post(`/api/tickets/${ticket.id}/confirm-resolution`)
      .set('Authorization', bearer('lee'))
      .send({});
    expect(otherEmployee.status).toBe(404);
    expect(agent.status).toBe(403);

    const detail = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('ari'));
    expect(
      detail.body.audit.filter(
        (entry: { action: string }) =>
          entry.action === 'ticket.requester_confirmed_resolution'
      )
    ).toHaveLength(1);
  });

  it('lets admins assign tickets and assigned agents update status', async () => {
    const ticket = (await createTicket('dana')).body.ticket;

    const assigned = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ assigneeId: users.lee.id });
    expect(assigned.status).toBe(200);

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ status: 'in_progress' });

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
    ).toEqual(['ticket.created', 'ticket.updated', 'ticket.status_updated']);
  });

  it('enforces legal status transitions', async () => {
    const ticket = (await createTicket('dana')).body.ticket;
    await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ assigneeId: users.lee.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ status: 'closed' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('must be one of');
  });

  it('lets assigned agents close and reopen tickets independently of work status', async () => {
    const ticket = (await createTicket('dana')).body.ticket;
    await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ assigneeId: users.lee.id });

    const closed = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ isOpen: false });
    expect(closed.status).toBe(200);
    expect(closed.body.ticket).toMatchObject({
      status: 'pending',
      isOpen: false,
    });

    const reopened = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ isOpen: true });
    expect(reopened.status).toBe(200);
    expect(reopened.body.ticket).toMatchObject({
      status: 'pending',
      isOpen: true,
    });
  });

  it('rejects assignment to an employee', async () => {
    const ticket = (await createTicket('dana')).body.ticket;

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ assigneeId: users.sam.id });

    expect(response.status).toBe(400);
  });

  it('rejects assignment to an admin', async () => {
    const ticket = (await createTicket('dana')).body.ticket;
    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({ assigneeId: users.ari.id });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('only be assigned to an agent');
  });

  it('prevents agents from assigning tickets', async () => {
    const ticket = (await createTicket('dana')).body.ticket;
    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ assigneeId: users.lee.id });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Only admins can assign');
  });

  it('returns 409 when the ticket changed since the caller loaded it', async () => {
    const ticket = (await createTicket('dana')).body.ticket;

    await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('ari'))
      .send({
        status: 'in_progress',
        assigneeId: users.lee.id,
        expectedUpdatedAt: ticket.updatedAt,
      });

    const stale = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', bearer('lee'))
      .send({ status: 'in_progress', expectedUpdatedAt: ticket.updatedAt });

    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('conflict');
  });
});
