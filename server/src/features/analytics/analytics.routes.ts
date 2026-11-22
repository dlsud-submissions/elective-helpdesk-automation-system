import { Router, type RequestHandler } from 'express';
import { handle } from '../../shared/http/errors.js';
import { requireRole } from '../auth/index.js';
import type { AnalyticsService } from './analytics.service.js';

export function createAnalyticsRouter(deps: {
  requireAuth: RequestHandler;
  analytics: AnalyticsService;
}): Router {
  const router = Router();

  router.get(
    '/api/analytics/summary',
    deps.requireAuth,
    requireRole('agent', 'admin'),
    handle(async (request, response) => {
      response.json({
        summary: await deps.analytics.summary({
          from: request.query.from,
          to: request.query.to,
        }),
      });
    })
  );

  return router;
}
