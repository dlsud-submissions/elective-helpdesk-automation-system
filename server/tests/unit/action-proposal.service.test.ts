import { describe, expect, it } from 'vitest';
import {
  getMissingFields,
  parseActionProposal,
  ProposalValidationError,
  sanitizeUserText,
} from '../../src/features/actions/service/action-proposal.service.js';

describe('parseActionProposal', () => {
  it('accepts a valid ticket proposal', () => {
    const proposal = parseActionProposal({
      intent: 'create_ticket',
      confidence: 0.9,
      arguments: {
        title: 'Laptop cannot connect',
        description: 'The demo laptop disconnects from Wi-Fi.',
        category: 'network',
        priority: 'medium',
      },
      reason: 'The request describes a support issue.',
    });

    expect(proposal.intent).toBe('create_ticket');
    expect(getMissingFields(proposal)).toEqual([]);
  });

  it('parses JSON text and reports absent required details for clarification', () => {
    const proposal = parseActionProposal(
      JSON.stringify({
        intent: 'create_ticket',
        confidence: 0.8,
        arguments: { title: 'Laptop issue' },
        reason: 'The category and description are not available.',
      })
    );

    expect(getMissingFields(proposal)).toEqual([
      'description',
      'category',
      'priority',
    ]);
  });

  it.each([
    {
      name: 'unsupported intent',
      proposal: {
        intent: 'delete_user',
        confidence: 1,
        arguments: {},
        reason: 'Not allowed.',
      },
    },
    {
      name: 'unknown argument',
      proposal: {
        intent: 'create_ticket',
        confidence: 1,
        arguments: { title: 'Issue', is_admin: true },
        reason: 'Not allowed.',
      },
    },
    {
      name: 'invalid category',
      proposal: {
        intent: 'create_ticket',
        confidence: 1,
        arguments: { category: 'payroll' },
        reason: 'Not allowed.',
      },
    },
    {
      name: 'invalid confidence',
      proposal: {
        intent: 'create_ticket',
        confidence: 2,
        arguments: {},
        reason: 'Not allowed.',
      },
    },
  ])('rejects $name', ({ proposal }) => {
    expect(() => parseActionProposal(proposal)).toThrow(
      ProposalValidationError
    );
  });

  it('rejects oversized JSON text', () => {
    expect(() => parseActionProposal(' '.repeat(16_385))).toThrow(
      'Proposal is too large.'
    );
  });
});

describe('sanitizeUserText', () => {
  it('removes credentials and unnecessary contact details from stored text', () => {
    expect(
      sanitizeUserText(
        'Password: Secret42; contact demo@example.test at +1 (555) 123-4567'
      )
    ).toBe('Password [REDACTED]; contact [REDACTED EMAIL] at [REDACTED PHONE]');
  });
});
