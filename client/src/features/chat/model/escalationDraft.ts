import {
  ESCALATION_SUMMARY_MAX,
  ESCALATION_TITLE_MAX,
} from '../api/escalation.api';
import type { EscalationDraft } from '../ui/EscalationPanel';
import type { ChatMessage } from '../types';

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/**
 * Builds the escalation an agent will read from the conversation up to the
 * assistant message at `index`: what the employee asked and what the assistant
 * already tried. The employee reviews and can edit it before sending, and the
 * server redacts credentials again before storing it.
 */
export function buildEscalationDraft(
  messages: ChatMessage[],
  index: number
): EscalationDraft {
  const upTo = messages.slice(0, index + 1);
  const assistant = messages[index];
  const questions = upTo
    .filter((message) => message.senderType === 'user')
    .map((message) => oneLine(message.content));
  const latest = questions.at(-1) ?? '';
  const uncertain = assistant?.outcome === 'escalation_suggested';

  const lines = [
    `Employee question: ${latest || 'Not provided.'}`,
    ...(questions.length > 1
      ? [`Earlier in this chat: ${questions.slice(0, -1).join(' | ')}`]
      : []),
    uncertain
      ? 'Assistant result: no approved procedure was found.'
      : `Assistant result: suggested approved steps${
          assistant?.sourceRefs.length
            ? ` from ${assistant.sourceRefs.map((source) => source.title).join(', ')}`
            : ''
        }, but the employee still needs help.`,
    'The employee asked to talk to an IT agent.',
  ];

  return {
    title: clip(latest || 'Help requested from chat', ESCALATION_TITLE_MAX),
    summary: clip(lines.join('\n'), ESCALATION_SUMMARY_MAX),
    reason: uncertain ? 'low_confidence' : 'user_requested_agent',
  };
}
