import { Router, type Request, type Response } from 'express';
import type {
  ActionAuthProvider,
  ActionRepository,
  AuthenticatedUser,
} from './types/action.types.js';
import {
  getMissingFields,
  isAuthorizedForIntent,
  parseActionProposal,
  ProposalValidationError,
  sanitizeUserText,
  validateActionContext,
} from './service/action-proposal.service.js';
import { ActionPersistenceError } from './service/supabase-action.repository.js';

interface ActionRouterDependencies {
  authProvider: ActionAuthProvider;
  repository: ActionRepository;
  testNotificationSimulationEnabled: boolean;
}

function sendError(response: Response, status: number, error: string) {
  response.status(status).json({ status: 'error', error });
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}

function validateIdempotencyKey(request: Request): string | undefined {
  const key = request.header('idempotency-key');
  if (!key || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    return undefined;
  }
  return key;
}

function getConfirmedIntent(request: Request): string | undefined {
  return request.header('x-action-confirmed');
}

function getStringArgument(
  arguments_: Record<string, unknown>,
  name: string
): string {
  const value = arguments_[name];
  if (typeof value !== 'string') {
    throw new ProposalValidationError(`${name} is required.`);
  }
  return value;
}

function getOptionalStringArgument(
  arguments_: Record<string, unknown>,
  name: string
): string | undefined {
  const value = arguments_[name];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ProposalValidationError(`${name} must be a string.`);
  }
  return value;
}

export function createActionRouter({
  authProvider,
  repository,
  testNotificationSimulationEnabled,
}: ActionRouterDependencies): Router {
  const router = Router();

  router.post('/api/actions/execute', async (request, response) => {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      sendError(response, 401, 'Authentication is required.');
      return;
    }

    let user: AuthenticatedUser | null;
    try {
      user = await authProvider.authenticate(accessToken);
    } catch (error) {
      console.error('Action request authentication failed.', error);
      sendError(response, 503, 'Authentication service is unavailable.');
      return;
    }
    if (!user) {
      sendError(response, 401, 'Authentication is required.');
      return;
    }
    try {
      if (
        typeof request.body !== 'object' ||
        request.body === null ||
        Array.isArray(request.body) ||
        Object.keys(request.body).some(
          (key) => !['proposal', 'context'].includes(key)
        )
      ) {
        throw new ProposalValidationError('Request body is invalid.');
      }

      const proposal = parseActionProposal(request.body.proposal);
      const context = validateActionContext(request.body.context);
      if (proposal.intent === 'unsupported') {
        response.json({
          status: 'unsupported',
          message: 'This request is outside the supported helpdesk actions.',
        });
        return;
      }
      if (proposal.intent === 'knowledge_question') {
        response.json({
          status: 'not_actionable',
          message: 'This proposal does not request a helpdesk action.',
        });
        return;
      }

      const missingFields = getMissingFields(proposal);
      if (missingFields.length > 0) {
        response.status(422).json({
          status: 'needs_clarification',
          missing_fields: missingFields,
          message: 'More information is needed before this action can proceed.',
        });
        return;
      }
      if (proposal.intent === 'request_clarification') {
        if (!context.conversation_id) {
          response.status(422).json({
            status: 'needs_clarification',
            missing_fields: ['conversation_id'],
            message: 'A conversation is required to request clarification.',
          });
          return;
        }
        response.json({
          status: 'pending',
          action: proposal.intent,
          field_names: proposal.arguments.field_names,
          message: proposal.arguments.question,
        });
        return;
      }
      if (proposal.confidence < 0.5) {
        response.status(422).json({
          status: 'needs_clarification',
          missing_fields: [],
          message: 'The request is uncertain and requires clarification.',
        });
        return;
      }

      if (!isAuthorizedForIntent(user, proposal.intent)) {
        sendError(response, 403, 'You are not authorized for this action.');
        return;
      }
      if (
        proposal.intent === 'send_test_notification' &&
        !testNotificationSimulationEnabled
      ) {
        sendError(
          response,
          403,
          'The test notification simulation is disabled.'
        );
        return;
      }
      if (getConfirmedIntent(request) !== proposal.intent) {
        sendError(response, 409, 'Explicit confirmation is required.');
        return;
      }

      const idempotencyKey = validateIdempotencyKey(request);
      if (!idempotencyKey) {
        sendError(response, 400, 'A valid Idempotency-Key header is required.');
        return;
      }

      if (proposal.intent === 'create_ticket') {
        const title = sanitizeForStorage(
          getStringArgument(proposal.arguments, 'title'),
          120,
          'title'
        );
        const description = sanitizeForStorage(
          getStringArgument(proposal.arguments, 'description'),
          4_000,
          'description'
        );
        const result = await repository.createTicket({
          requesterId: user.id,
          title,
          description,
          category: getStringArgument(proposal.arguments, 'category'),
          priority: getStringArgument(proposal.arguments, 'priority'),
          idempotencyKey,
          ...context,
        });
        response.status(201).json({
          status: 'success',
          action: proposal.intent,
          ticket_id: result.ticketId,
          status_label: result.status,
        });
        return;
      }

      if (proposal.intent === 'escalate_to_human') {
        const title = sanitizeForStorage(
          getStringArgument(proposal.arguments, 'title'),
          120,
          'title'
        );
        const summary = sanitizeForStorage(
          getStringArgument(proposal.arguments, 'summary'),
          2_000,
          'summary'
        );
        const result = await repository.escalateToHuman({
          requesterId: user.id,
          title,
          summary,
          reason: getStringArgument(proposal.arguments, 'reason'),
          idempotencyKey,
          ...context,
        });
        response.status(201).json({
          status: 'success',
          action: proposal.intent,
          ticket_id: result.ticketId,
          status_label: result.status,
          queue: result.queue,
        });
        return;
      }

      const result = await repository.recordTestNotification({
        requesterId: user.id,
        channel: 'simulation',
        message: sanitizeUserText(
          getStringArgument(proposal.arguments, 'message')
        ),
        ticketId: getOptionalStringArgument(proposal.arguments, 'ticket_id'),
        conversationId: getOptionalStringArgument(
          proposal.arguments,
          'conversation_id'
        ),
        idempotencyKey,
      });
      response.status(201).json({
        status: 'success',
        action: proposal.intent,
        channel: 'simulation',
        run_id: result.runId,
        status_label: result.status,
      });
    } catch (error) {
      if (error instanceof ProposalValidationError) {
        sendError(response, 400, error.message);
        return;
      }
      if (error instanceof ActionPersistenceError) {
        sendError(response, error.statusCode, error.message);
        return;
      }
      console.error('Helpdesk action execution failed.', error);
      sendError(
        response,
        502,
        'The action could not be completed. No successful outcome is available.'
      );
    }
  });

  return router;
}

function sanitizeForStorage(
  value: string,
  maxLength: number,
  fieldName: string
): string {
  const sanitized = sanitizeUserText(value);
  if (sanitized.length === 0 || sanitized.length > maxLength) {
    throw new ProposalValidationError(
      `${fieldName} must contain 1–${maxLength} characters after redaction.`
    );
  }
  return sanitized;
}
