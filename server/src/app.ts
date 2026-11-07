import cors from 'cors';
import express from 'express';
import { getAllowedOrigins } from './config/cors.js';
import { actionRouter } from './features/actions/index.js';
import { helloRouter } from './features/hello/index.js';

export const app = express();

app.use(cors({ origin: getAllowedOrigins() }));
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use(helloRouter);
app.use(actionRouter);

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      response.status(413).json({
        status: 'error',
        error: 'Request body exceeds the allowed size.',
      });
      return;
    }
    if (error instanceof SyntaxError) {
      response
        .status(400)
        .json({ status: 'error', error: 'Request body must be valid JSON.' });
      return;
    }
    console.error('Unhandled API request error.', error);
    response
      .status(500)
      .json({ status: 'error', error: 'The request could not be processed.' });
  }
);
