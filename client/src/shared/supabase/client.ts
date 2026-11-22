import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

let client: SupabaseClient | undefined;

/**
 * Browser Supabase client. Uses only the public URL and publishable/anon key;
 * it is used for sign-in/sign-out and session storage, not for data access.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new Error(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
