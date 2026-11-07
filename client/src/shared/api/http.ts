import { env } from '../config/env';

export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'validation'
  | 'timeout'
  | 'network'
  | 'server';

/** A controlled API failure the UI can explain without leaking internals. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider = async () => null;
let unauthorizedHandler: (() => void) | null = null;

/** Wired by the auth feature so requests carry the user's session token. */
export function configureApiAuth(options: {
  getAccessToken: TokenProvider;
  onUnauthorized: () => void;
}): void {
  tokenProvider = options.getAccessToken;
  unauthorizedHandler = options.onUnauthorized;
}

export const DEFAULT_TIMEOUT_MS = 20_000;

const fallbackMessages: Record<ApiErrorKind, string> = {
  unauthorized: 'Your session has expired. Sign in again.',
  forbidden: "You don't have permission to do that.",
  notFound: 'That item could not be found.',
  conflict: 'This item was changed by someone else. Reload to see changes.',
  validation: 'Please check your input and try again.',
  timeout: 'The request took too long. Please try again.',
  network: "We couldn't reach the helpdesk. Check your connection and retry.",
  server: 'Something went wrong on our side. Please try again.',
};

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 504 || status === 408) return 'timeout';
  if (status >= 400 && status < 500) return 'validation';
  return 'server';
}

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  timeoutMs?: number;
  /** Skip the global sign-out on 401 (used while loading the profile). */
  skipUnauthorizedHandler?: boolean;
};

/**
 * Calls the Express API with the current Supabase access token. Only the
 * user's own session token is sent; no privileged credential exists here.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await tokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('timeout', fallbackMessages.timeout);
    }
    throw new ApiError('network', fallbackMessages.network);
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const kind = kindForStatus(response.status);
    const body = (payload ?? {}) as { error?: unknown; code?: unknown };
    const serverMessage =
      typeof body.error === 'string' && kind !== 'server' ? body.error : null;
    const error = new ApiError(
      kind,
      serverMessage ?? fallbackMessages[kind],
      response.status,
      typeof body.code === 'string' ? body.code : null
    );
    if (kind === 'unauthorized' && !options.skipUnauthorizedHandler) {
      unauthorizedHandler?.();
    }
    throw error;
  }

  return payload as T;
}

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError('server', fallbackMessages.server);
}
