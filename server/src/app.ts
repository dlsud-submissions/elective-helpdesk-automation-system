import cors from 'cors';
import express, { type Express } from 'express';
import { getAllowedOrigins } from './config/cors.js';
import {
  createActionRouter,
  SupabaseActionRepository,
  type ActionRepository,
} from './features/actions/index.js';
import {
  AnalyticsService,
  createAnalyticsRouter,
} from './features/analytics/index.js';
import {
  createAuthRouter,
  createRequireAuth,
  SupabaseAuthVerifier,
  SupabaseProfileDirectory,
  type AuthVerifier,
  type ProfileDirectory,
} from './features/auth/index.js';
import {
  answerKnowledgeQuestion,
  ConversationService,
  createChatRouter,
  SupabaseConversationRepository,
  type AnswerProvider,
  type ConversationRepository,
} from './features/chat/index.js';
import { helloRouter } from './features/hello/index.js';
import { createKnowledgeRouter } from './features/knowledge/index.js';
import { createKbSubmissionsRouter } from './features/kb-submissions/index.js';
import type { KnowledgeService } from './features/knowledge/knowledge.service.js';
import { GeminiTicketSolutionGenerator } from './shared/ai/gemini-ticket-solution.js';
import {
  createTicketRouter,
  SupabaseTicketRepository,
  TicketService,
  type TicketRepository,
} from './features/tickets/index.js';
import { jsonErrorHandler } from './shared/http/errors.js';

export type AppDependencies = {
  authVerifier: AuthVerifier;
  profiles: ProfileDirectory;
  tickets: TicketRepository;
  conversations: ConversationRepository;
  answer: AnswerProvider;
  knowledge?: Pick<KnowledgeService, 'search'>;
  answerTimeoutMs?: number;
  actions?: ActionRepository;
  testNotificationSimulationEnabled?: boolean;
};

/** Builds the API. Tests inject fakes; production uses Supabase adapters. */
export function createApp(overrides: Partial<AppDependencies> = {}): Express {
  const profiles = overrides.profiles ?? new SupabaseProfileDirectory();
  const deps: AppDependencies = {
    profiles,
    authVerifier: overrides.authVerifier ?? new SupabaseAuthVerifier(profiles),
    tickets: overrides.tickets ?? new SupabaseTicketRepository(),
    conversations:
      overrides.conversations ?? new SupabaseConversationRepository(),
    answer: overrides.answer ?? answerKnowledgeQuestion,
    answerTimeoutMs: overrides.answerTimeoutMs,
  };

  const requireAuth = createRequireAuth(deps.authVerifier);
  const ticketService = new TicketService(
    deps.tickets,
    deps.profiles,
    deps.conversations,
    new GeminiTicketSolutionGenerator()
  );
  const conversationService = new ConversationService(
    deps.conversations,
    deps.answer,
    deps.answerTimeoutMs,
    {
      listConversationIdsForAgent: async (agentId) =>
        (await deps.tickets.list({ assignedTo: agentId }))
          .map((ticket) => ticket.conversationId)
          .filter((id): id is string => id !== null),
      hasLinkedTicket: async (conversationId) =>
        Boolean(await deps.tickets.findByConversationId(conversationId)),
      isAssigned: async (conversationId) =>
        Boolean(
          (await deps.tickets.findByConversationId(conversationId))?.assignedTo
        ),
      isAssignedToAgent: async (conversationId, agentId) =>
        (await deps.tickets.findByConversationId(conversationId))
          ?.assignedTo === agentId,
      isResolvedAndAssignedToAgent: async (conversationId, agentId) => {
        const ticket = await deps.tickets.findByConversationId(conversationId);
        return ticket?.assignedTo === agentId && ticket.status === 'resolved';
      },
    }
  );
  const analyticsService = new AnalyticsService({
    listAll: () => deps.tickets.list({}),
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: getAllowedOrigins() }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use(helloRouter);
  app.use(createAuthRouter({ requireAuth, profiles: deps.profiles }));
  app.use(createTicketRouter({ requireAuth, tickets: ticketService }));
  app.use(createKnowledgeRouter({ requireAuth, service: overrides.knowledge }));
  app.use(createKbSubmissionsRouter({ requireAuth }));
  app.use(
    createChatRouter({ requireAuth, conversations: conversationService })
  );
  app.use(createAnalyticsRouter({ requireAuth, analytics: analyticsService }));
  app.use(
    createActionRouter({
      // Actions share the API's verified-session path, so roles always come
      // from public.profiles and tests can inject a fake verifier.
      authProvider: {
        authenticate: async (accessToken) => {
          const result = await deps.authVerifier.verify(accessToken);
          return result.status === 'ok'
            ? { id: result.context.userId, role: result.context.role }
            : null;
        },
      },
      repository: overrides.actions ?? new SupabaseActionRepository(),
      testNotificationSimulationEnabled:
        overrides.testNotificationSimulationEnabled ??
        process.env.ENABLE_TEST_NOTIFICATION_SIMULATION === 'true',
    })
  );

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction
    ) => {
      if (response.headersSent) {
        next(error);
        return;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        error.type === 'entity.too.large'
      ) {
        response.status(413).json({
          status: 'error',
          error: 'Request body exceeds the allowed size.',
          code: 'payload_too_large',
        });
        return;
      }
      next(error);
    }
  );

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Not found.', code: 'not_found' });
  });
  app.use(jsonErrorHandler);

  return app;
}

export const app = createApp();
