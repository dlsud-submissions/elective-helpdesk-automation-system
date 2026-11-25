import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

let client: SupabaseClient | undefined;
type SessionPersistence = 'session' | 'thirty-days' | 'persistent';
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
const storageMarker = '__harborSession';
let sessionPersistence: SessionPersistence = 'persistent';

export function setSessionPersistence(mode: SessionPersistence): void {
  sessionPersistence = mode;
}

function localStorageValue(raw: string | null, key: string): string | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as {
      marker?: string;
      value?: string;
      expiresAt?: number;
    };
    if (stored.marker === storageMarker) {
      if (
        typeof stored.value !== 'string' ||
        typeof stored.expiresAt !== 'number' ||
        stored.expiresAt <= Date.now()
      ) {
        window.localStorage.removeItem(key);
        return null;
      }
      return stored.value;
    }
  } catch {
    return raw;
  }
  return raw;
}

export const authStorage = {
  getItem(key: string): string | null {
    const tabValue = window.sessionStorage.getItem(key);
    return tabValue ?? localStorageValue(window.localStorage.getItem(key), key);
  },
  setItem(key: string, value: string): void {
    if (sessionPersistence === 'session') {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
      return;
    }
    if (sessionPersistence === 'thirty-days') {
      const current = window.localStorage.getItem(key);
      let expiresAt: number | undefined;
      if (current) {
        try {
          const stored = JSON.parse(current) as {
            marker?: string;
            expiresAt?: number;
          };
          if (stored.marker === storageMarker) expiresAt = stored.expiresAt;
        } catch {
          // A fresh login replaces a legacy, non-expiring session.
        }
      }
      window.localStorage.setItem(
        key,
        JSON.stringify({
          marker: storageMarker,
          value,
          expiresAt:
            expiresAt && expiresAt > Date.now()
              ? expiresAt
              : Date.now() + thirtyDaysMs,
        })
      );
      window.sessionStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
    window.sessionStorage.removeItem(key);
  },
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

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
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: authStorage,
      },
    });
  }
  return client;
}
