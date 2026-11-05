import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../http/errors.js';

export type DatabaseConfig = {
  url: string;
  serviceRoleKey: string;
  isConfigured: boolean;
};

export function getDatabaseConfig(): DatabaseConfig {
  const url = process.env.SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  return {
    url,
    serviceRoleKey,
    isConfigured: Boolean(url && serviceRoleKey),
  };
}

let serviceClient: SupabaseClient | undefined;

/**
 * Server-only Supabase client using the service role key. It bypasses RLS, so
 * every caller must enforce authorization in application code first. Never
 * expose this client, its key, or its raw errors to the browser.
 */
export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const config = getDatabaseConfig();
  if (!config.isConfigured) {
    throw new HttpError(
      503,
      'service_unavailable',
      'The helpdesk database is not configured.'
    );
  }

  serviceClient = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

/** Converts a Supabase/PostgREST error into a safe 503 without leaking details. */
export function databaseError(
  error: { message?: string } | null,
  context: string
): HttpError {
  console.error(`Database error during ${context}:`, error?.message);
  return new HttpError(
    503,
    'service_unavailable',
    'The helpdesk database is unavailable. Please try again.'
  );
}
