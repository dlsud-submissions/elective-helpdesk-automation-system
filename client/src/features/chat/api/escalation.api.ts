import { apiFetch, ApiError } from '../../../shared/api/http';

export type EscalationReason = 'low_confidence' | 'user_requested_agent';

export type EscalationRequest = {
  conversationId: string | null;
  title: string;
  summary: string;
  reason: EscalationReason;
};

export type EscalationResult = { ticketId: string; queue: string };

type ExecuteResponse = {
  status?: unknown;
  ticket_id?: unknown;
  queue?: unknown;
};

/** The server allowlist limits (server/src/features/actions). */
export const ESCALATION_TITLE_MAX = 120;
export const ESCALATION_SUMMARY_MAX = 2000;

/**
 * Hands the conversation to a human agent through the allowlisted action
 * endpoint. The employee confirmed the request in the UI, so the proposal is
 * sent with the matching confirmation header; the server still validates the
 * proposal, the caller's role, and the idempotency key. Retrying with the same
 * key returns the original escalation instead of creating a second one.
 */
export async function escalateToHuman(
  request: EscalationRequest,
  idempotencyKey: string
): Promise<EscalationResult> {
  const response = await apiFetch<ExecuteResponse>('/api/actions/execute', {
    method: 'POST',
    idempotencyKey,
    headers: { 'X-Action-Confirmed': 'escalate_to_human' },
    body: {
      proposal: {
        intent: 'escalate_to_human',
        confidence: 1,
        reason:
          request.reason === 'low_confidence'
            ? 'The assistant found no approved procedure and the employee asked for a person.'
            : 'The employee asked for a person after the suggested answer.',
        arguments: {
          title: request.title,
          summary: request.summary,
          reason: request.reason,
        },
      },
      ...(request.conversationId
        ? { context: { conversation_id: request.conversationId } }
        : {}),
    },
  });

  // Only a persisted escalation counts as success.
  if (
    response?.status !== 'success' ||
    typeof response.ticket_id !== 'string' ||
    typeof response.queue !== 'string'
  ) {
    throw new ApiError(
      'server',
      "We couldn't confirm the escalation. Please try again."
    );
  }
  return { ticketId: response.ticket_id, queue: response.queue };
}
