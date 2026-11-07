import type { Request, Response } from 'express';
import { knowledgeService } from './knowledge.runtime.js';

export const knowledgeController = {
  search: async (request: Request, response: Response) => {
    try {
      const query = request.query.q;
      if (typeof query !== 'string') {
        response.status(400).json({ error: 'A query parameter is required.' });
        return;
      }

      const results = await knowledgeService.search(query);
      response.json({ results });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Knowledge search failed.';
      response.status(503).json({ error: message });
    }
  },
};
