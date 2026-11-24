import { Router, type RequestHandler } from 'express';
import {
  handle,
  badRequest,
  forbidden,
  notFound,
} from '../../shared/http/errors.js';
import { getAuth, requireRole } from '../auth/index.js';
import { isUuid } from '../../shared/validation/uuid.js';
import { kbSubmissionRepository } from './kb-submissions.repository.js';
import type { KbSubmissionStatus } from './kb-submissions.types.js';

export function createKbSubmissionsRouter(deps: {
  requireAuth: RequestHandler;
}): Router {
  const router = Router();
  const repo = kbSubmissionRepository;

  router.use('/api/kb-submissions', deps.requireAuth);

  // Agent submits a (problem, solution) pair for admin review
  router.post(
    '/api/kb-submissions',
    requireRole('agent'),
    handle(async (request, response) => {
      const auth = getAuth(request);
      const body = request.body as Record<string, unknown>;
      const input = typeof body.input === 'string' ? body.input.trim() : '';
      const solution =
        typeof body.solution === 'string' ? body.solution.trim() : '';
      const ticketId = typeof body.ticketId === 'string' ? body.ticketId : null;
      const ticketReference =
        typeof body.ticketReference === 'string' ? body.ticketReference : null;

      if (!input)
        throw badRequest('input (the problem description) is required.');
      if (!solution) throw badRequest('solution is required.');
      if (input.length > 5000)
        throw badRequest('input must be 5000 characters or fewer.');
      if (solution.length > 8000)
        throw badRequest('solution must be 8000 characters or fewer.');

      const submission = await repo.create({
        ticketId,
        ticketReference,
        agentId: auth.userId,
        agentName: auth.displayName,
        input,
        solution,
      });
      response.status(201).json({ submission });
    })
  );

  // Admin views all submissions (optionally filtered by status)
  router.get(
    '/api/kb-submissions',
    requireRole('admin'),
    handle(async (request, response) => {
      const status = request.query.status as KbSubmissionStatus | undefined;
      const submissions = await repo.list(status ? { status } : undefined);
      response.json({ submissions });
    })
  );

  // Admin accepts or denies a submission
  router.patch(
    '/api/kb-submissions/:id',
    requireRole('admin'),
    handle(async (request, response) => {
      const { id } = request.params;
      if (!id || !isUuid(id)) throw notFound('Submission not found.');
      const body = request.body as Record<string, unknown>;
      const status = body.status as string;
      if (status !== 'accepted' && status !== 'denied') {
        throw badRequest('status must be "accepted" or "denied".');
      }
      const adminNote =
        typeof body.adminNote === 'string' ? body.adminNote.trim() : undefined;
      const updated = await repo.updateStatus(
        id,
        status as KbSubmissionStatus,
        adminNote
      );
      if (!updated) throw notFound('Submission not found.');
      response.json({ submission: updated });
    })
  );

  return router;
}
