import { Router, type RequestHandler } from 'express';
import { badRequest, handle } from '../../shared/http/errors.js';
import { getAuth, requireRole } from '../auth/index.js';
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
  const employees = requireRole('employee');
  const chatReaders = requireRole('employee', 'agent');

  // Stateless grounded-answer endpoint from S2-06, now authenticated.
  router.post(
    '/api/chat/answer',
    deps.requireAuth,
    employees,
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
    employees,
    handle(async (request, response) => {
      const result = await conversations.send(request.body, getAuth(request));
      response.status(201).json(result);
    })
  );

  router.get(
    '/api/conversations',
    deps.requireAuth,
    chatReaders,
    handle(async (request, response) => {
      response.json({
        conversations: await conversations.list(getAuth(request)),
      });
    })
  );

  router.get(
    '/api/conversations/archived',
    deps.requireAuth,
    employees,
    handle(async (request, response) => {
      response.json({
        conversations: await conversations.listArchived(getAuth(request)),
      });
    })
  );

  router.patch(
    '/api/conversations/:conversationId',
    deps.requireAuth,
    chatReaders,
    handle(async (request, response) => {
      const conversationId = routeId(request.params.conversationId);
      const body = request.body as Record<string, unknown>;
      if ('title' in body) {
        response.json({
          conversation: await conversations.rename(
            conversationId,
            body.title,
            getAuth(request)
          ),
        });
        return;
      }
      if ('archived' in body) {
        response.json({
          conversation: await conversations.setArchived(
            conversationId,
            body.archived,
            getAuth(request)
          ),
        });
        return;
      }
      throw badRequest('Conversation update requires title or archived.');
    })
  );

  router.delete(
    '/api/conversations/:conversationId',
    deps.requireAuth,
    chatReaders,
    handle(async (request, response) => {
      await conversations.delete(
        routeId(request.params.conversationId),
        getAuth(request)
      );
      response.status(204).send();
    })
  );

  router.get(
    '/api/conversations/:conversationId/messages',
    deps.requireAuth,
    chatReaders,
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
