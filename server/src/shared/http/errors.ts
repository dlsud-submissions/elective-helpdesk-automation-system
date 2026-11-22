import type { NextFunction, Request, Response } from 'express';

export type ErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'profile_not_found'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'timeout'
  | 'answer_unavailable'
  | 'service_unavailable'
  | 'internal_error';

/** An error with a safe, client-facing message and a stable code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string) =>
  new HttpError(400, 'validation_error', message);
export const unauthorized = (message = 'Sign in to continue.') =>
  new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have permission to do that.') =>
  new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') =>
  new HttpError(404, 'not_found', message);

export function sendError(response: Response, error: unknown): void {
  if (error instanceof HttpError) {
    response
      .status(error.status)
      .json({ error: error.message, code: error.code });
    return;
  }

  // Never leak internal details (SQL, stack traces, provider messages).
  console.error(error);
  response.status(500).json({
    error: 'Something went wrong. Please try again.',
    code: 'internal_error',
  });
}

/** Final Express error handler so unhandled failures still return JSON. */
export function jsonErrorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction
): void {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (
    error instanceof SyntaxError &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    sendError(response, badRequest('Request body must be valid JSON.'));
    return;
  }

  sendError(response, error);
}

/** Wraps a route handler so thrown errors become controlled JSON responses. */
export function handle(
  fn: (request: Request, response: Response) => Promise<void> | void
) {
  return async (request: Request, response: Response) => {
    try {
      await fn(request, response);
    } catch (error) {
      sendError(response, error);
    }
  };
}
