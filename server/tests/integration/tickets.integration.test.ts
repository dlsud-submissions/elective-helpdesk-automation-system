import request from 'supertest';
import { describe, expect, it, beforeEach } from 'vitest';
import { app } from '../../src/app.js';
import { resetTicketState } from '../../src/features/tickets/index.js';

describe('ticket endpoints', () => {
  beforeEach(() => {
    resetTicketState();
  });

  it('creates a ticket with server-derived requester context', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('x-user-id', 'user-123')
      .set('x-user-name', 'Harvey Rullan')
      .send({
        title: 'Cannot sign in to VPN',
        description: 'My VPN connection fails after multi-factor prompt.',
        category: 'network',
        priority: 'high',
      });

    expect(response.status).toBe(201);
    expect(response.body.ticket).toMatchObject({
      title: 'Cannot sign in to VPN',
      status: 'new',
      requesterId: 'user-123',
      requesterName: 'Harvey Rullan',
    });
  });

  it('rejects invalid ticket input', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .send({ title: '', description: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('required');
  });

  it('enforces legal status transitions', async () => {
    const created = await request(app).post('/api/tickets').send({
      title: 'MFA reset',
      description: 'Need new phone provisioning.',
    });

    const ticketId = created.body.ticket.id;

    const invalidTransition = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .send({ status: 'closed' });

    expect(invalidTransition.status).toBe(400);
    expect(invalidTransition.body.error).toContain('not allowed');
  });
});
