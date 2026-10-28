import { randomUUID } from 'node:crypto';
import {
  generateGroundedAnswer,
  type RetrievalSource,
} from '../../shared/ai/gemini.adapter.js';
import { knowledgeArticles } from '../../shared/knowledge/seed.js';

export type ChatQuestion = {
  question: string;
};

export type ChatAnswer = {
  id: string;
  question: string;
  answer: string;
  sources: Array<{
    id: string;
    title: string;
    sourceName: string;
    excerpt: string;
    relevance: number;
  }>;
  confidence: 'high' | 'medium' | 'low';
  status: 'answered' | 'insufficient_context';
};

function rankKnowledgeForQuestion(question: string): RetrievalSource[] {
  const normalized = question.toLowerCase();

  return knowledgeArticles
    .filter((article) => article.isPublished)
    .map((article) => {
      const articleContent = `${article.title} ${article.body}`.toLowerCase();
      const matches = articleContent.split(/\s+/).filter((term) => normalized.includes(term)).length;
      const similarity = matches > 0 ? Math.min(0.95, 0.35 + matches / 20) : 0;
      return {
        id: article.id,
        title: article.title,
        sourceName: article.sourceName,
        content: article.body,
        similarity,
      };
    })
    .filter((result) => result.similarity > 0.2)
    .sort((left, right) => right.similarity - left.similarity);
}

export function validateQuestion(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('A question is required.');
  }

  const question = input.trim();

  if (!question) {
    throw new Error('A question is required.');
  }

  if (question.length > 1000) {
    throw new Error('Question must be 1000 characters or fewer.');
  }

  return question;
}

export function answerKnowledgeQuestion(question: string): ChatAnswer {
  const unsupportedScope = /(payroll|finance|legal|hr|benefits|banking|salary)/i;

  if (unsupportedScope.test(question)) {
    return {
      id: randomUUID(),
      question,
      answer:
        'I could not find enough approved internal guidance to answer that request safely. Please verify the ticket details or ask a supported IT procedure question.',
      sources: [],
      confidence: 'low',
      status: 'insufficient_context',
    };
  }

  const sources = rankKnowledgeForQuestion(question);
  const grounded = generateGroundedAnswer(question, sources);

  return {
    id: randomUUID(),
    question,
    answer: grounded.answer,
    sources: grounded.sources,
    confidence: grounded.confidence,
    status: grounded.status,
  };
}
