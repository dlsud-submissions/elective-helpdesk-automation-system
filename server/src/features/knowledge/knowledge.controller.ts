import type { Request, Response } from 'express';
import { badRequest, HttpError } from '../../shared/http/errors.js';
import type { KnowledgeService } from './knowledge.service.js';

const MAX_QUERY_LENGTH = 1000;

export function createKnowledgeController(
  service: Pick<KnowledgeService, 'search'>
) {
  return {
    search: async (request: Request, response: Response) => {
      const query = request.query.q;
      if (typeof query !== 'string' || !query.trim()) {
        throw badRequest('A non-empty query parameter is required.');
      }
      if (query.trim().length > MAX_QUERY_LENGTH) {
        throw badRequest(
          `Search query must be ${MAX_QUERY_LENGTH} characters or fewer.`
        );
      }

      try {
        const results = await service.search(query.trim());
        response.json({ results });
      } catch {
        console.error('Knowledge search failed.');
        throw new HttpError(
          503,
          'service_unavailable',
          'Knowledge search is temporarily unavailable.'
        );
      }
    },
  };
}
