import { Router, type RequestHandler } from 'express';
import { knowledgeService } from './knowledge.runtime.js';
import { createKnowledgeController } from './knowledge.controller.js';
import type { KnowledgeService } from './knowledge.service.js';

export function createKnowledgeRouter(deps: {
  requireAuth: RequestHandler;
  service?: Pick<KnowledgeService, 'search'>;
}): Router {
  const router = Router();
  const controller = createKnowledgeController(
    deps.service ?? knowledgeService
  );
  router.get('/api/knowledge/search', deps.requireAuth, controller.search);
  return router;
}
