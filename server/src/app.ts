import cors from 'cors';
import express, { type Express } from 'express';
import { getAllowedOrigins } from './config/cors.js';
import { actionRouter } from './features/actions/index.js';
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
import { knowledgeRouter } from './features/knowledge/index.js';
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
  answerTimeoutMs?: number;
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
  const ticketService = new TicketService(deps.tickets, deps.profiles);
  const conversationService = new ConversationService(
    deps.conversations,
    deps.answer,
    deps.answerTimeoutMs
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
  app.use(knowledgeRouter);
  app.use(
    createChatRouter({ requireAuth, conversations: conversationService })
  );
  app.use(createAnalyticsRouter({ requireAuth, analytics: analyticsService }));
  app.use(actionRouter);

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
