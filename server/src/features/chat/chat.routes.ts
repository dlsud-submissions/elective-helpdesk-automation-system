import { Router, type RequestHandler } from 'express';
import { handle } from '../../shared/http/errors.js';
import { getAuth } from '../auth/index.js';
import { answerKnowledgeQuestion, validateQuestion } from './chat.service.js';
import type { ConversationService } from './conversation.service.js';

function routeId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function createChatRouter(deps: {
  requireAuth: RequestHandler;
  conversations: ConversationService;
}): Router {
  const router = Router();
  const { conversations } = deps;

  // Stateless grounded-answer endpoint from S2-06, now authenticated.
  router.post(
    '/api/chat/answer',
    deps.requireAuth,
    handle((request, response) => {
      let question: string;
      try {
        question = validateQuestion(request.body?.question);
      } catch (error) {
        response.status(400).json({
          error: error instanceof Error ? error.message : 'Invalid question.',
          code: 'validation_error',
        });
        return;
      }
      response.json(answerKnowledgeQuestion(question));
    })
  );

  router.post(
    '/api/chat/messages',
    deps.requireAuth,
    handle(async (request, response) => {
      const result = await conversations.send(request.body, getAuth(request));
      response.status(201).json(result);
    })
  );

  router.get(
    '/api/conversations',
    deps.requireAuth,
    handle(async (request, response) => {
      response.json({
        conversations: await conversations.list(getAuth(request)),
      });
    })
  );

  router.get(
    '/api/conversations/:conversationId/messages',
    deps.requireAuth,
    handle(async (request, response) => {
      response.json(
        await conversations.getMessages(
          routeId(request.params.conversationId),
          getAuth(request)
        )
      );
    })
  );

  return router;
}
