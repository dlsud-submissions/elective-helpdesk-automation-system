import type { Request, Response } from 'express';
import {
  createHelloResponse,
  validateHelloMessage,
} from './service/hello.service.js';

export const helloController = {
  greet: (request: Request, response: Response) => {
    try {
      const received = validateHelloMessage(request.body?.message);
      response.json(createHelloResponse(received));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'A non-empty message is required.';

      response.status(400).json({ error: message });
    }
  },
};
