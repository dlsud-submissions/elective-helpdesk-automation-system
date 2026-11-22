import type { SupabaseClient } from '@supabase/supabase-js';
import {
  databaseError,
  getServiceClient,
} from '../../shared/database/index.js';
import {
  appRoles,
  type AppRole,
  type AuthVerifier,
  type ProfileDirectory,
  type ProfileRecord,
  type VerifyResult,
} from './auth.types.js';

type ProfileRow = { id: string; display_name: string | null; role: string };

function toProfile(row: ProfileRow): ProfileRecord | null {
  if (!appRoles.includes(row.role as AppRole)) return null;
  return {
    id: row.id,
    displayName: row.display_name?.trim() || 'Helpdesk user',
    role: row.role as AppRole,
  };
}

export class SupabaseProfileDirectory implements ProfileDirectory {
  constructor(
    private readonly client: () => SupabaseClient = getServiceClient
  ) {}

  async findById(id: string): Promise<ProfileRecord | null> {
    const { data, error } = await this.client()
      .from('profiles')
      .select('id, display_name, role')
      .eq('id', id)
      .maybeSingle<ProfileRow>();
    if (error) throw databaseError(error, 'profile lookup');
    return data ? toProfile(data) : null;
  }

  async listStaff(): Promise<ProfileRecord[]> {
    const { data, error } = await this.client()
      .from('profiles')
      .select('id, display_name, role')
      .in('role', ['agent', 'admin'])
      .order('display_name');
    if (error) throw databaseError(error, 'staff lookup');
    return ((data ?? []) as ProfileRow[])
      .map(toProfile)
      .filter((profile): profile is ProfileRecord => profile !== null);
  }
}

/**
 * Verifies a Supabase access token with Supabase Auth, then loads the
 * authoritative role from public.profiles. user_metadata is never trusted.
 */
export class SupabaseAuthVerifier implements AuthVerifier {
  constructor(
    private readonly profiles: ProfileDirectory = new SupabaseProfileDirectory(),
    private readonly client: () => SupabaseClient = getServiceClient
  ) {}

  async verify(accessToken: string): Promise<VerifyResult> {
    const { data, error } = await this.client().auth.getUser(accessToken);
    if (error || !data.user) return { status: 'invalid' };

    const profile = await this.profiles.findById(data.user.id);
    if (!profile) return { status: 'no_profile' };

    return {
      status: 'ok',
      context: {
        userId: profile.id,
        role: profile.role,
        displayName: profile.displayName,
      },
    };
  }
}
