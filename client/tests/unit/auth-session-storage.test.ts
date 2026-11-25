import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authStorage,
  setSessionPersistence,
} from '../../src/shared/supabase/client';

const storageKey = 'sb-example-auth-token';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

let localStore: Storage;
let sessionStore: Storage;

describe('employee session persistence', () => {
  beforeEach(() => {
    localStore = memoryStorage();
    sessionStore = memoryStorage();
    vi.stubGlobal('window', {
      localStorage: localStore,
      sessionStorage: sessionStore,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T10:00:00.000Z'));
  });

  afterEach(() => {
    setSessionPersistence('persistent');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stores unremembered employee sessions in tab storage only', () => {
    setSessionPersistence('session');
    authStorage.setItem(storageKey, 'session-value');

    expect(sessionStore.getItem(storageKey)).toBe('session-value');
    expect(localStore.getItem(storageKey)).toBeNull();
    expect(authStorage.getItem(storageKey)).toBe('session-value');
  });

  it('expires remembered sessions 30 days after the initial sign-in', () => {
    setSessionPersistence('thirty-days');
    authStorage.setItem(storageKey, 'initial-value');
    const first = JSON.parse(localStore.getItem(storageKey)!) as {
      value: string;
      expiresAt: number;
    };

    vi.advanceTimersByTime(10 * 24 * 60 * 60 * 1000);
    authStorage.setItem(storageKey, 'refreshed-value');
    expect(
      (
        JSON.parse(localStore.getItem(storageKey)!) as {
          expiresAt: number;
        }
      ).expiresAt
    ).toBe(first.expiresAt);
    expect(authStorage.getItem(storageKey)).toBe('refreshed-value');

    vi.advanceTimersByTime(20 * 24 * 60 * 60 * 1000);
    expect(authStorage.getItem(storageKey)).toBeNull();
    expect(localStore.getItem(storageKey)).toBeNull();
  });

  it('preserves the existing persistent storage behavior for staff', () => {
    setSessionPersistence('persistent');
    authStorage.setItem(storageKey, 'staff-session');

    expect(localStore.getItem(storageKey)).toBe('staff-session');
    expect(authStorage.getItem(storageKey)).toBe('staff-session');
  });
});
