import type {
  ActionRepository,
  EscalationResult,
  SimulationResult,
  TicketResult,
} from '../types/action.types.js';

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export class ActionPersistenceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 409 | 422 | 502
  ) {
    super(message);
    this.name = 'ActionPersistenceError';
  }
}

function readConfig(): SupabaseConfig {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase action persistence is not configured.');
  }
  return {
    url: SUPABASE_URL.replace(/\/+$/, ''),
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  };
}

export class SupabaseActionRepository implements ActionRepository {
  async createTicket(input: {
    requesterId: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    idempotencyKey: string;
    conversationId?: string;
  }): Promise<TicketResult> {
    const result = await this.callRpc('create_helpdesk_ticket', {
      p_requester_id: input.requesterId,
      p_title: input.title,
      p_description: input.description,
      p_category: input.category,
      p_priority: input.priority,
      p_idempotency_key: input.idempotencyKey,
      p_conversation_id: input.conversationId ?? null,
    });
    return parseTicketResult(result, 'open');
  }

  async escalateToHuman(input: {
    requesterId: string;
    title: string;
    summary: string;
    reason: string;
    conversationId?: string;
    idempotencyKey: string;
  }): Promise<EscalationResult> {
    const result = await this.callRpc('create_helpdesk_escalation', {
      p_requester_id: input.requesterId,
      p_title: input.title,
      p_summary: input.summary,
      p_reason: input.reason,
      p_conversation_id: input.conversationId ?? null,
      p_idempotency_key: input.idempotencyKey,
    });
    const ticketResult = parseTicketResult(result, 'escalated');
    if (!isRecord(result) || typeof result.queue !== 'string') {
      throw new Error('Supabase returned an invalid escalation result.');
    }
    return { ...ticketResult, queue: result.queue };
  }

  async recordTestNotification(input: {
    requesterId: string;
    channel: 'simulation';
    message: string;
    ticketId?: string;
    conversationId?: string;
    idempotencyKey: string;
  }): Promise<SimulationResult> {
    const result = await this.callRpc('record_test_notification', {
      p_requester_id: input.requesterId,
      p_channel: input.channel,
      p_message: input.message,
      p_ticket_id: input.ticketId ?? null,
      p_conversation_id: input.conversationId ?? null,
      p_idempotency_key: input.idempotencyKey,
    });
    if (
      !isRecord(result) ||
      typeof result.runId !== 'string' ||
      typeof result.status !== 'string' ||
      !['success', 'failed'].includes(result.status)
    ) {
      throw new Error('Supabase returned an invalid simulation result.');
    }
    return { runId: result.runId, status: result.status };
  }

  private async callRpc(
    functionName: string,
    body: Record<string, string | null>
  ): Promise<unknown> {
    const config = readConfig();
    const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      let errorCode: unknown;
      try {
        const errorBody: unknown = await response.json();
        if (
          typeof errorBody === 'object' &&
          errorBody !== null &&
          'code' in errorBody
        ) {
          errorCode = errorBody.code;
        }
      } catch {
        errorCode = undefined;
      }
      if (errorCode === '23505') {
        throw new ActionPersistenceError(
          'This idempotency key has already been used for another action.',
          409
        );
      }
      if (errorCode === '22023') {
        throw new ActionPersistenceError(
          'The supplied ticket or conversation is invalid.',
          422
        );
      }
      throw new ActionPersistenceError(
        `Supabase action persistence failed (${response.status}).`,
        502
      );
    }
    const result: unknown = await response.json();
    return result;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTicketResult(
  result: unknown,
  expectedStatus: 'open' | 'escalated'
): TicketResult {
  if (
    !isRecord(result) ||
    typeof result.ticketId !== 'string' ||
    result.ticketId.length === 0 ||
    typeof result.status !== 'string' ||
    result.status !== expectedStatus
  ) {
    throw new Error('Supabase returned an invalid ticket result.');
  }
  return { ticketId: result.ticketId, status: result.status };
}
