import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseActionRepository } from '../../src/features/actions/service/supabase-action.repository.js';

describe('SupabaseActionRepository', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('maps the persisted succeeded status to the API success status', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-key');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          runId: '66666666-6666-4666-8666-666666666666',
          status: 'succeeded',
        })
      )
    );

    const result = await new SupabaseActionRepository().recordTestNotification({
      requesterId: '22222222-2222-4222-8222-222222222222',
      channel: 'simulation',
      message: 'A new test ticket is ready.',
      ticketId: '77777777-7777-4777-8777-777777777777',
      idempotencyKey: 'notification-001',
    });

    expect(result).toEqual({
      runId: '66666666-6666-4666-8666-666666666666',
      status: 'success',
    });
  });
});
