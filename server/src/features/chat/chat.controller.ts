import type { Request, Response } from 'express';
import { answerKnowledgeQuestion, validateQuestion } from './chat.service.js';

export const chatController = {
  answer: (request: Request, response: Response) => {
    try {
      const question = validateQuestion(request.body?.question);
      const answer = answerKnowledgeQuestion(question);

      response.json(answer);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The answer request could not be processed.';
      response.status(400).json({ error: message });
    }
  },
};
