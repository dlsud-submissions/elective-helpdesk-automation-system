import type { NextFunction, Request, Response } from 'express';
import {
  forbidden,
  HttpError,
  sendError,
  unauthorized,
} from '../../shared/http/errors.js';
import type { AppRole, AuthContext, AuthVerifier } from './auth.types.js';

export function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/** Rejects requests without a valid Supabase session; attaches request.auth. */
export function createRequireAuth(verifier: AuthVerifier) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const token = readBearerToken(request.headers.authorization);
      if (!token) throw unauthorized();

      const result = await verifier.verify(token);
      if (result.status === 'invalid') {
        throw unauthorized('Your session has expired. Sign in again.');
      }
      if (result.status === 'no_profile') {
        throw new HttpError(
          403,
          'profile_not_found',
          'Your account is not set up for the helpdesk yet. Contact IT.'
        );
      }

      request.auth = result.context;
      next();
    } catch (error) {
      sendError(response, error);
    }
  };
}

/** Backend authorization boundary for role-restricted routes. */
export function requireRole(...roles: AppRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.auth) {
      sendError(response, unauthorized());
      return;
    }
    if (!roles.includes(request.auth.role)) {
      sendError(response, forbidden());
      return;
    }
    next();
  };
}

export function getAuth(request: Request): AuthContext {
  if (!request.auth) throw unauthorized();
  return request.auth;
}
