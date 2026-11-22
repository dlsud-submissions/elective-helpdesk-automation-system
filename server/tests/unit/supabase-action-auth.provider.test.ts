import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseActionAuthProvider } from '../../src/features/actions/service/supabase-action-auth.provider.js';

describe('SupabaseActionAuthProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('validates the access token and loads the authoritative profile role', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://helpdesk.example.test');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-test-key');

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: '22222222-2222-4222-8222-222222222222',
            user_metadata: { role: 'admin' },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ role: 'employee' }]), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const user = await new SupabaseActionAuthProvider().authenticate(
      'valid-access-token'
    );

    expect(user).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      role: 'employee',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://helpdesk.example.test/auth/v1/user'
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: {
          apikey: 'public-test-key',
          authorization: 'Bearer valid-access-token',
        },
      })
    );

    const profileRequest = fetchMock.mock.calls[1]?.[0];
    expect(profileRequest).toBeInstanceOf(URL);
    expect((profileRequest as URL).searchParams.get('id')).toBe(
      'eq.22222222-2222-4222-8222-222222222222'
    );
    expect((profileRequest as URL).searchParams.get('select')).toBe('role');
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: {
          apikey: 'server-test-key',
          authorization: 'Bearer server-test-key',
        },
      })
    );
  });

  it('rejects invalid access tokens without loading a profile', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://helpdesk.example.test');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-test-key');
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new SupabaseActionAuthProvider().authenticate('expired-token')
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the user has no valid application profile role', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://helpdesk.example.test');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-test-key');
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: '22222222-2222-4222-8222-222222222222',
            user_metadata: { role: 'admin' },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ role: 'admin-from-metadata' }]), {
          status: 200,
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new SupabaseActionAuthProvider().authenticate('valid-access-token')
    ).resolves.toBeNull();
  });
});
