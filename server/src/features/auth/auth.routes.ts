import { Router, type RequestHandler } from 'express';
import { handle } from '../../shared/http/errors.js';
import { getAuth, requireRole } from './auth.middleware.js';
import type { ProfileDirectory } from './auth.types.js';

export function createAuthRouter(deps: {
  requireAuth: RequestHandler;
  profiles: ProfileDirectory;
}): Router {
  const router = Router();

  router.get(
    '/api/me',
    deps.requireAuth,
    handle((request, response) => {
      const auth = getAuth(request);
      response.json({
        profile: {
          id: auth.userId,
          displayName: auth.displayName,
          role: auth.role,
        },
      });
    })
  );

  router.get(
    '/api/agents',
    deps.requireAuth,
    requireRole('agent', 'admin'),
    handle(async (_request, response) => {
      const staff = await deps.profiles.listStaff();
      response.json({ agents: staff });
    })
  );

  return router;
}
