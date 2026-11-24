import { Router, type RequestHandler } from 'express';
import { badRequest, handle } from '../../shared/http/errors.js';
import { getAuth, requireRole } from '../auth/index.js';
import type { TicketService } from './tickets.service.js';

function routeId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function validateIdempotencyKey(value: string | undefined): string {
  if (!value || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw badRequest('A valid Idempotency-Key header is required.');
  }
  return value;
}

export function createTicketRouter(deps: {
  requireAuth: RequestHandler;
  tickets: TicketService;
}): Router {
  const router = Router();
  const { tickets } = deps;

  router.use('/api/tickets', deps.requireAuth);

  router.get(
    '/api/tickets',
    handle(async (request, response) => {
      response.json({ tickets: await tickets.list(getAuth(request)) });
    })
  );

  router.post(
    '/api/tickets',
    requireRole('employee'),
    handle(async (request, response) => {
      const ticket = await tickets.create(
        request.body,
        getAuth(request),
        {},
        validateIdempotencyKey(request.header('idempotency-key'))
      );
      response.status(201).json({ ticket });
    })
  );

  router.get(
    '/api/tickets/:ticketId',
    handle(async (request, response) => {
      const result = await tickets.get(
        routeId(request.params.ticketId),
        getAuth(request)
      );
      response.json(result);
    })
  );

  router.post(
    '/api/tickets/:ticketId/solution-draft/generate',
    requireRole('agent'),
    handle(async (request, response) => {
      response.json({
        solution: await tickets.generateSolutionDraft(
          routeId(request.params.ticketId),
          getAuth(request)
        ),
      });
    })
  );

  router.post(
    '/api/tickets/:ticketId/solution-draft',
    requireRole('agent'),
    handle(async (request, response) => {
      response.status(201).json({
        draft: await tickets.saveSolutionDraft(
          routeId(request.params.ticketId),
          request.body,
          getAuth(request)
        ),
      });
    })
  );

  router.post(
    '/api/tickets/:ticketId/messages',
    requireRole('agent', 'admin'),
    handle(async (request, response) => {
      response.status(201).json({
        message: await tickets.reply(
          routeId(request.params.ticketId),
          request.body,
          getAuth(request)
        ),
      });
    })
  );

  router.patch(
    '/api/tickets/:ticketId',
    requireRole('agent', 'admin'),
    handle(async (request, response) => {
      const ticket = await tickets.update(
        routeId(request.params.ticketId),
        request.body,
        getAuth(request)
      );
      response.json({ ticket });
    })
  );

  return router;
}
