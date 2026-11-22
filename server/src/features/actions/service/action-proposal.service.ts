import type {
  ActionIntent,
  ActionProposal,
  AuthenticatedUser,
} from '../types/action.types.js';

const MAX_PROPOSAL_LENGTH = 16_384;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 4_000;
const MAX_SUMMARY_LENGTH = 2_000;
const MAX_MESSAGE_LENGTH = 500;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const intentArguments: Record<ActionIntent, readonly string[]> = {
  create_ticket: ['title', 'description', 'category', 'priority'],
  escalate_to_human: ['title', 'summary', 'reason'],
  send_test_notification: [
    'channel',
    'message',
    'ticket_id',
    'conversation_id',
  ],
  request_clarification: ['field_names', 'question'],
  knowledge_question: [],
  unsupported: ['missing_fields'],
};

const ticketCategories = new Set([
  'hardware',
  'software',
  'network',
  'account',
  'other',
]);
const priorities = new Set(['low', 'medium', 'high']);
const escalationReasons = new Set([
  'low_confidence',
  'policy_gap',
  'user_requested_agent',
]);
const clarificationFields = new Set([
  'title',
  'description',
  'category',
  'priority',
  'summary',
  'reason',
  'conversation_id',
  'device_type',
  'error_message',
  'steps_attempted',
]);

export class ProposalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isActionIntent(value: unknown): value is ActionIntent {
  return typeof value === 'string' && Object.hasOwn(intentArguments, value);
}

function validateString(
  value: unknown,
  name: string,
  maxLength: number
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new ProposalValidationError(
      `${name} must be a non-empty string of at most ${maxLength} characters.`
    );
  }
  return value.trim();
}

function validateArguments(
  intent: ActionIntent,
  value: unknown
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ProposalValidationError('Proposal arguments must be an object.');
  }

  const allowedFields = intentArguments[intent];
  const unexpected = Object.keys(value).find(
    (field) => !allowedFields.includes(field)
  );
  if (unexpected) {
    throw new ProposalValidationError(
      `Unexpected argument "${unexpected}" for ${intent}.`
    );
  }

  const result: Record<string, unknown> = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    switch (field) {
      case 'title':
        result.title = validateString(fieldValue, 'title', MAX_TITLE_LENGTH);
        break;
      case 'description':
        result.description = validateString(
          fieldValue,
          'description',
          MAX_DESCRIPTION_LENGTH
        );
        break;
      case 'summary':
        result.summary = validateString(
          fieldValue,
          'summary',
          MAX_SUMMARY_LENGTH
        );
        break;
      case 'category':
        if (
          typeof fieldValue !== 'string' ||
          !ticketCategories.has(fieldValue)
        ) {
          throw new ProposalValidationError(
            'Ticket category is not supported.'
          );
        }
        result.category = fieldValue;
        break;
      case 'priority':
        if (typeof fieldValue !== 'string' || !priorities.has(fieldValue)) {
          throw new ProposalValidationError(
            'Ticket priority is not supported.'
          );
        }
        result.priority = fieldValue;
        break;
      case 'reason':
        if (
          typeof fieldValue !== 'string' ||
          !escalationReasons.has(fieldValue)
        ) {
          throw new ProposalValidationError(
            'Escalation reason is not supported.'
          );
        }
        result.reason = fieldValue;
        break;
      case 'channel':
        if (fieldValue !== 'simulation') {
          throw new ProposalValidationError(
            'Only the simulation notification channel is supported.'
          );
        }
        result.channel = fieldValue;
        break;
      case 'message':
        result.message = validateString(
          fieldValue,
          'message',
          MAX_MESSAGE_LENGTH
        );
        break;
      case 'ticket_id':
      case 'conversation_id':
        if (typeof fieldValue !== 'string' || !UUID_PATTERN.test(fieldValue)) {
          throw new ProposalValidationError(`${field} must be a valid UUID.`);
        }
        result[field] = fieldValue;
        break;
      case 'missing_fields':
        if (
          !Array.isArray(fieldValue) ||
          fieldValue.length > 8 ||
          fieldValue.some(
            (fieldName) =>
              typeof fieldName !== 'string' ||
              !clarificationFields.has(fieldName)
          )
        ) {
          throw new ProposalValidationError(
            'missing_fields must contain only supported field names.'
          );
        }
        result.missing_fields = [...new Set(fieldValue)];
        break;
      case 'field_names':
        if (
          !Array.isArray(fieldValue) ||
          fieldValue.length === 0 ||
          fieldValue.length > 8 ||
          fieldValue.some(
            (fieldName) =>
              typeof fieldName !== 'string' ||
              !clarificationFields.has(fieldName)
          )
        ) {
          throw new ProposalValidationError(
            'field_names must contain supported field names.'
          );
        }
        result.field_names = [...new Set(fieldValue)];
        break;
      case 'question':
        result.question = validateString(fieldValue, 'question', 500);
        break;
    }
  }

  return result;
}

export function parseActionProposal(input: unknown): ActionProposal {
  let value = input;
  if (typeof input === 'string') {
    if (input.length > MAX_PROPOSAL_LENGTH) {
      throw new ProposalValidationError('Proposal is too large.');
    }
    try {
      const parsed: unknown = JSON.parse(input);
      value = parsed;
    } catch {
      throw new ProposalValidationError('Proposal must contain valid JSON.');
    }
  }

  if (!isRecord(value)) {
    throw new ProposalValidationError('Proposal must be a JSON object.');
  }
  if (
    Object.keys(value).some(
      (key) => !['intent', 'confidence', 'arguments', 'reason'].includes(key)
    )
  ) {
    throw new ProposalValidationError('Proposal contains an unexpected field.');
  }

  const intent = value.intent;
  if (!isActionIntent(intent)) {
    throw new ProposalValidationError('Proposal intent is not supported.');
  }
  if (
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    throw new ProposalValidationError(
      'Proposal confidence must be between 0 and 1.'
    );
  }

  return {
    intent,
    confidence: value.confidence,
    arguments: validateArguments(intent, value.arguments),
    reason: validateString(value.reason, 'reason', 500),
  };
}

export function validateActionContext(input: unknown): {
  conversation_id?: string;
} {
  if (input === undefined) {
    return {};
  }
  if (
    !isRecord(input) ||
    Object.keys(input).some((key) => key !== 'conversation_id')
  ) {
    throw new ProposalValidationError('Action context is invalid.');
  }
  if (input.conversation_id === undefined) {
    return {};
  }
  if (
    typeof input.conversation_id !== 'string' ||
    !UUID_PATTERN.test(input.conversation_id)
  ) {
    throw new ProposalValidationError('conversation_id must be a valid UUID.');
  }
  return { conversation_id: input.conversation_id };
}

export function getMissingFields(proposal: ActionProposal): string[] {
  const args = proposal.arguments;
  switch (proposal.intent) {
    case 'create_ticket':
      return ['title', 'description', 'category', 'priority'].filter(
        (field) => args[field] === undefined
      );
    case 'escalate_to_human':
      return ['title', 'summary', 'reason'].filter(
        (field) => args[field] === undefined
      );
    case 'send_test_notification':
      return [
        'channel',
        'message',
        ...(args.ticket_id === undefined && args.conversation_id === undefined
          ? ['ticket_id or conversation_id']
          : []),
      ].filter((field) => args[field] === undefined);
    case 'request_clarification':
      return ['field_names', 'question'].filter(
        (field) => args[field] === undefined
      );
    default:
      return [];
  }
}

export function sanitizeUserText(value: string): string {
  return value
    .replace(
      /\b(password|passcode|one[- ]time code|otp|api[ _-]?key|access token|refresh token|secret)\b\s*(?:is|=|:)?\s*[^\s,;]+/gi,
      '$1 [REDACTED]'
    )
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
    .replace(
      /(?<![A-Z0-9])\+?\d[\d(). -]{7,}\d(?![A-Z0-9])/gi,
      '[REDACTED PHONE]'
    )
    .trim();
}

export function isAuthorizedForIntent(
  user: AuthenticatedUser,
  intent: ActionIntent
): boolean {
  if (intent === 'send_test_notification') {
    return user.role === 'agent' || user.role === 'admin';
  }
  return (
    user.role === 'employee' || user.role === 'agent' || user.role === 'admin'
  );
}
