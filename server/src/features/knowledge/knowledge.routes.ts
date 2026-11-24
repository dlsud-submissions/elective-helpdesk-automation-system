import { Router, type RequestHandler } from 'express';
import { getServiceClient } from '../../shared/database/index.js';
import { handle } from '../../shared/http/errors.js';
import { requireRole } from '../auth/index.js';
import { knowledgeService } from './knowledge.runtime.js';
import { createKnowledgeController } from './knowledge.controller.js';
import type { KnowledgeService } from './knowledge.service.js';
import { knowledgeArticles } from '../../shared/knowledge/seed.js';

export function createKnowledgeRouter(deps: {
  requireAuth: RequestHandler;
  service?: Pick<KnowledgeService, 'search'>;
}): Router {
  const router = Router();
  const controller = createKnowledgeController(
    deps.service ?? knowledgeService
  );
  router.get('/api/knowledge/search', deps.requireAuth, controller.search);

  /**
   * Admin endpoint: list all knowledge articles (seeded + Supabase rows).
   * Reads from Supabase `knowledge_articles`; falls back to the in-memory seed
   * if the table is unavailable.
   */
  router.get(
    '/api/knowledge/articles',
    deps.requireAuth,
    requireRole('admin'),
    handle(async (_request, response) => {
      try {
        const { data, error } = await getServiceClient()
          .from('knowledge_articles')
          .select('id, title, body, category, source_name, is_published')
          .order('title');

        if (error) throw error;

        const articles = (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          category: row.category,
          sourceName: row.source_name,
          isPublished: row.is_published ?? true,
          source: 'supabase' as const,
        }));

        response.json({ articles });
      } catch {
        // Fall back to seeded articles when the table doesn't exist yet
        const articles = knowledgeArticles.map((a) => ({
          ...a,
          source: 'seed' as const,
        }));
        response.json({ articles });
      }
    })
  );

  return router;
}
