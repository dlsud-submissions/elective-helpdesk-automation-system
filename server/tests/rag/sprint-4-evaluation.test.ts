import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { answerKnowledgeQuestion } from '../../src/features/chat/chat.service.js';

type EvaluationCase = {
  id: string;
  question: string;
  answerability: 'answerable' | 'ambiguous' | 'no-match' | 'adversarial';
  expectedSourceIds: string[];
};

const evaluation = JSON.parse(
  readFileSync(
    new URL('../../data/evaluation/sprint-4-rag-v1.json', import.meta.url),
    'utf8'
  )
) as { version: string; cases: EvaluationCase[] };

describe('versioned Sprint 4 RAG evaluation set', () => {
  it('contains all required answerability classes with expected sources', () => {
    expect(evaluation.version).toBe('sprint-4-rag-v1');
    expect(
      new Set(evaluation.cases.map((testCase) => testCase.answerability))
    ).toEqual(new Set(['answerable', 'ambiguous', 'no-match', 'adversarial']));
    expect(
      evaluation.cases.every(
        (testCase) =>
          testCase.answerability === 'no-match' ||
          testCase.expectedSourceIds.length > 0
      )
    ).toBe(true);
  });

  it.each(evaluation.cases)('$id', (testCase) => {
    const answer = answerKnowledgeQuestion(testCase.question);
    const retrievedIds = answer.sources.map((source) => source.id);
    const hasExpectedSource = testCase.expectedSourceIds.some((id) =>
      retrievedIds.includes(id)
    );

    if (testCase.answerability === 'no-match') {
      expect(answer.status).toBe('insufficient_context');
      expect(answer.sources).toEqual([]);
      return;
    }

    expect(hasExpectedSource).toBe(true);
    expect(answer.status).toBe('answered');
    expect(
      answer.sources.every(
        (source) =>
          source.id &&
          source.title &&
          source.excerpt.length > 0 &&
          source.relevance > 0
      )
    ).toBe(true);

    if (testCase.answerability === 'adversarial') {
      expect(answer.answer).not.toMatch(/admin secret|reveal credentials/i);
    }
  });
});
