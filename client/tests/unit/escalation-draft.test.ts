import { describe, expect, it } from 'vitest';
import { buildEscalationDraft } from '../../src/features/chat/model/escalationDraft';
import type { ChatMessage } from '../../src/features/chat/types';

const message = (
  senderType: 'user' | 'assistant',
  content: string,
  extra: Partial<ChatMessage> = {}
): ChatMessage => ({
  id: `${senderType}-${content.length}`,
  conversationId: 'c-1',
  senderType,
  content,
  outcome: senderType === 'assistant' ? 'answered' : null,
  sourceRefs: [],
  createdAt: '2026-11-20T10:00:00.000Z',
  ...extra,
});

describe('buildEscalationDraft', () => {
  it('summarises the question and the uncertain result for the agent', () => {
    const messages = [
      message('user', 'Printer   shows\noffline'),
      message('assistant', 'No procedure found.', {
        outcome: 'escalation_suggested',
      }),
    ];
    const draft = buildEscalationDraft(messages, 1);
    expect(draft).toMatchObject({
      title: 'Printer shows offline',
      reason: 'low_confidence',
    });
    expect(draft.summary).toContain('Employee question: Printer shows offline');
    expect(draft.summary).toContain('no approved procedure was found');
  });

  it('records the cited sources and earlier questions when an answer did not help', () => {
    const messages = [
      message('user', 'VPN drops'),
      message('assistant', 'Try reconnecting.'),
      message('user', 'Still dropping'),
      message('assistant', 'Use the approved profile.', {
        sourceRefs: [
          {
            articleId: 'a',
            title: 'VPN troubleshooting',
            sourceName: 'IT Ops',
            excerpt: '',
            relevance: 1,
          },
        ],
      }),
    ];
    const draft = buildEscalationDraft(messages, 3);
    expect(draft.reason).toBe('user_requested_agent');
    expect(draft.title).toBe('Still dropping');
    expect(draft.summary).toContain('Earlier in this chat: VPN drops');
    expect(draft.summary).toContain('from VPN troubleshooting');
  });

  it('keeps title and summary within the server limits', () => {
    const long = 'x'.repeat(5000);
    const draft = buildEscalationDraft(
      [message('user', long), message('assistant', 'No.')],
      1
    );
    expect(draft.title.length).toBeLessThanOrEqual(120);
    expect(draft.summary.length).toBeLessThanOrEqual(2000);
  });
});
