import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActionRouter } from '../../src/features/actions/actions.routes.js';
import type {
  ActionRepository,
  AuthenticatedUser,
} from '../../src/features/actions/types/action.types.js';

const employee: AuthenticatedUser = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'employee',
};
const agent: AuthenticatedUser = {
  id: '33333333-3333-4333-8333-333333333333',
  role: 'agent',
};

const ticketProposal = {
  intent: 'create_ticket',
  confidence: 0.9,
  arguments: {
    title: 'Laptop cannot connect',
    description: 'Password: demo-secret; the device cannot join Wi-Fi.',
    category: 'network',
    priority: 'medium',
  },
  reason: 'The user reported a network issue.',
};

function createTestApp(
  repository: ActionRepository,
  user: AuthenticatedUser | null = employee,
  simulationEnabled = false
) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use(
    createActionRouter({
      authProvider: {
        authenticate: vi.fn(async (token: string) =>
          token === 'valid-token' ? user : null
        ),
      },
      repository,
      testNotificationSimulationEnabled: simulationEnabled,
    })
  );
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      if (response.headersSent) {
        _next(error);
        return;
      }
      const tooLarge =
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        error.type === 'entity.too.large';
      response.status(tooLarge ? 413 : 400).json({ status: 'error' });
    }
  );
  return app;
}

function createRepository(): ActionRepository {
  return {
    createTicket: vi.fn(async () => ({
      ticketId: '44444444-4444-4444-8444-444444444444',
      status: 'open',
    })),
    escalateToHuman: vi.fn(async () => ({
      ticketId: '55555555-5555-4555-8555-555555555555',
      status: 'escalated',
      queue: 'IT-agents',
    })),
    recordTestNotification: vi.fn(async () => ({
      runId: '66666666-6666-4666-8666-666666666666',
      status: 'success',
    })),
  };
}

function executeAction(
  app: express.Express,
  proposal: unknown,
  confirmation = 'create_ticket',
  context?: unknown
) {
  return request(app)
    .post('/api/actions/execute')
    .set('Authorization', 'Bearer valid-token')
    .set('X-Action-Confirmed', confirmation)
    .set('Idempotency-Key', 'ticket-001')
    .send({ proposal, ...(context === undefined ? {} : { context }) });
}

describe('POST /api/actions/execute', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requires an authenticated bearer token', async () => {
    const repository = createRepository();
    const response = await request(createTestApp(repository))
      .post('/api/actions/execute')
      .send({ proposal: ticketProposal });

    expect(response.status).toBe(401);
    expect(repository.createTicket).not.toHaveBeenCalled();
  });

  it('rejects malformed or extra model fields without dispatching', async () => {
    const repository = createRepository();
    const response = await executeAction(createTestApp(repository), {
      ...ticketProposal,
      arguments: { ...ticketProposal.arguments, admin: true },
    });

    expect(response.status).toBe(400);
    expect(repository.createTicket).not.toHaveBeenCalled();
  });

  it('rejects a malicious unsupported intent without triggering any handler', async () => {
    const repository = createRepository();
    const response = await executeAction(
      createTestApp(repository, agent, true),
      {
        intent: 'trigger_webhook',
        confidence: 1,
        arguments: { url: 'https://attacker.example.test' },
        reason: 'Injected model output.',
      },
      'trigger_webhook'
    );

    expect(response.status).toBe(400);
    expect(repository.createTicket).not.toHaveBeenCalled();
    expect(repository.escalateToHuman).not.toHaveBeenCalled();
    expect(repository.recordTestNotification).not.toHaveBeenCalled();
  });

  it('asks for missing fields instead of creating a partial ticket', async () => {
    const repository = createRepository();
    const response = await executeAction(createTestApp(repository), {
      ...ticketProposal,
      arguments: { title: 'Laptop issue' },
    });

    expect(response.status).toBe(422);
    expect(response.body.status).toBe('needs_clarification');
    expect(response.body.missing_fields).toEqual([
      'description',
      'category',
      'priority',
    ]);
    expect(repository.createTicket).not.toHaveBeenCalled();
  });

  it('returns a validated clarification without persisting an action', async () => {
    const repository = createRepository();
    const response = await executeAction(
      createTestApp(repository),
      {
        intent: 'request_clarification',
        confidence: 0.4,
        arguments: {
          field_names: ['device_type', 'error_message'],
          question: 'Which device and error message are involved?',
        },
        reason: 'The report is missing details.',
      },
      'request_clarification',
      { conversation_id: '88888888-8888-4888-8888-888888888888' }
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'pending',
      action: 'request_clarification',
      field_names: ['device_type', 'error_message'],
      message: 'Which device and error message are involved?',
    });
    expect(repository.createTicket).not.toHaveBeenCalled();
    expect(repository.escalateToHuman).not.toHaveBeenCalled();
  });

  it('requires explicit action confirmation before dispatching', async () => {
    const repository = createRepository();
    const response = await executeAction(
      createTestApp(repository),
      ticketProposal,
      'escalate_to_human'
    );

    expect(response.status).toBe(409);
    expect(repository.createTicket).not.toHaveBeenCalled();
  });

  it('persists an authorized ticket with server-derived identity and idempotency key', async () => {
    const repository = createRepository();
    const response = await executeAction(
      createTestApp(repository),
      ticketProposal
    );

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      status: 'success',
      action: 'create_ticket',
      ticket_id: '44444444-4444-4444-8444-444444444444',
      status_label: 'open',
    });
    expect(repository.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: employee.id,
        idempotencyKey: 'ticket-001',
        description: 'Password [REDACTED]; the device cannot join Wi-Fi.',
      })
    );
  });

  it('forwards the same idempotency key on a ticket retry', async () => {
    const repository = createRepository();
    const app = createTestApp(repository);
    const first = await executeAction(app, ticketProposal);
    const retry = await executeAction(app, ticketProposal);

    expect(first.body.ticket_id).toBe(retry.body.ticket_id);
    expect(repository.createTicket).toHaveBeenCalledTimes(2);
    expect(
      vi
        .mocked(repository.createTicket)
        .mock.calls.map(([input]) => input.idempotencyKey)
    ).toEqual(['ticket-001', 'ticket-001']);
  });

  it('returns a controlled failure when persistence fails', async () => {
    const repository = createRepository();
    vi.mocked(repository.createTicket).mockRejectedValueOnce(
      new Error('database unavailable')
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await executeAction(
      createTestApp(repository),
      ticketProposal
    );

    expect(response.status).toBe(502);
    expect(response.body.status).toBe('error');
    expect(response.body).not.toHaveProperty('ticket_id');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('persists escalation summaries and returns the queue outcome', async () => {
    const repository = createRepository();
    const response = await executeAction(
      createTestApp(repository),
      {
        intent: 'escalate_to_human',
        confidence: 0.9,
        arguments: {
          title: 'Cannot sign in',
          summary: 'The demo account cannot sign in; email demo@example.test.',
          reason: 'user_requested_agent',
        },
        reason: 'The user requests a person.',
      },
      'escalate_to_human'
    );

    expect(response.status).toBe(201);
    expect(response.body.ticket_id).toBe(
      '55555555-5555-4555-8555-555555555555'
    );
    expect(response.body.queue).toBe('IT-agents');
    expect(repository.escalateToHuman).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: employee.id,
        summary: 'The demo account cannot sign in; email [REDACTED EMAIL].',
      })
    );
  });

  it('prevents employees from dispatching the agent-only simulation', async () => {
    const repository = createRepository();
    const response = await executeAction(
      createTestApp(repository, employee, true),
      {
        intent: 'send_test_notification',
        confidence: 0.9,
        arguments: {
          channel: 'simulation',
          message: 'A new test ticket is ready.',
          ticket_id: '77777777-7777-4777-8777-777777777777',
        },
        reason: 'The proposal asks to test the demo workflow.',
      },
      'send_test_notification'
    );

    expect(response.status).toBe(403);
    expect(repository.recordTestNotification).not.toHaveBeenCalled();
  });

  it('restricts and labels test notifications as an enabled simulation', async () => {
    const repository = createRepository();
    const proposal = {
      intent: 'send_test_notification',
      confidence: 0.99,
      arguments: {
        channel: 'simulation',
        message: 'A new test ticket is ready.',
        ticket_id: '77777777-7777-4777-8777-777777777777',
      },
      reason: 'An agent requested a demo notification.',
    };

    const disabledResponse = await executeAction(
      createTestApp(repository, agent, false),
      proposal,
      'send_test_notification'
    );
    expect(disabledResponse.status).toBe(403);
    expect(repository.recordTestNotification).not.toHaveBeenCalled();

    const enabledResponse = await executeAction(
      createTestApp(repository, agent, true),
      proposal,
      'send_test_notification'
    );
    expect(enabledResponse.status).toBe(201);
    expect(enabledResponse.body.channel).toBe('simulation');
    expect(repository.recordTestNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: agent.id,
        channel: 'simulation',
      })
    );
  });

  it('does not claim a simulated notification succeeded if outcome recording fails', async () => {
    const repository = createRepository();
    vi.mocked(repository.recordTestNotification).mockRejectedValueOnce(
      new Error('database unavailable')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await executeAction(
      createTestApp(repository, agent, true),
      {
        intent: 'send_test_notification',
        confidence: 0.9,
        arguments: {
          channel: 'simulation',
          message: 'A new test ticket is ready.',
          ticket_id: '77777777-7777-4777-8777-777777777777',
        },
        reason: 'The proposal asks to test the demo workflow.',
      },
      'send_test_notification'
    );

    expect(response.status).toBe(502);
    expect(response.body.status).toBe('error');
    expect(response.body).not.toHaveProperty('run_id');
  });

  it('rejects oversized JSON requests', async () => {
    const response = await request(createTestApp(createRepository()))
      .post('/api/actions/execute')
      .set('Authorization', 'Bearer valid-token')
      .send({ proposal: 'x'.repeat(20_000) });

    expect(response.status).toBe(413);
  });
});
