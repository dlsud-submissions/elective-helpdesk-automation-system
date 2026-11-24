import { Router, type RequestHandler } from 'express';
import { handle } from '../../shared/http/errors.js';
import { getAuth } from '../auth/index.js';
import type { AnalyticsService } from './analytics.service.js';

export function createAnalyticsRouter(deps: {
  requireAuth: RequestHandler;
  analytics: AnalyticsService;
}): Router {
  const router = Router();

  router.get(
    '/api/analytics/summary',
    deps.requireAuth,
    handle(async (request, response) => {
      const caller = getAuth(request);
      const summary = await deps.analytics.summary(
        { from: request.query.from, to: request.query.to },
        caller
      );
      if (caller.role !== 'admin') {
        const safeSummary = Object.fromEntries(
          Object.entries(summary).filter(
            ([key]) =>
              key !== 'assignedTickets' &&
              key !== 'openEscalated' &&
              key !== 'openUnassigned'
          )
        );
        response.json({ summary: safeSummary });
        return;
      }
      response.json({
        summary,
      });
    })
  );

  return router;
}
