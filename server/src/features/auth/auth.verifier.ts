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

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string;
  account_status: 'active' | 'suspended' | 'banned';
  suspended_until: string | null;
  ban_reason: string | null;
};

function toProfile(row: ProfileRow): ProfileRecord | null {
  if (!appRoles.includes(row.role as AppRole)) return null;
  return {
    id: row.id,
    displayName: row.display_name?.trim() || 'Helpdesk user',
    role: row.role as AppRole,
    accountStatus: row.account_status ?? 'active',
    suspendedUntil: row.suspended_until,
    banReason: row.ban_reason,
  };
}

export class SupabaseProfileDirectory implements ProfileDirectory {
  constructor(
    private readonly client: () => SupabaseClient = getServiceClient
  ) {}

  async findById(id: string): Promise<ProfileRecord | null> {
    const { data, error } = await this.client()
      .from('profiles')
      .select(
        'id, display_name, role, account_status, suspended_until, ban_reason'
      )
      .eq('id', id)
      .maybeSingle<ProfileRow>();
    if (error) throw databaseError(error, 'profile lookup');
    return data ? toProfile(data) : null;
  }

  async listAll(): Promise<ProfileRecord[]> {
    const { data, error } = await this.client()
      .from('profiles')
      .select(
        'id, display_name, role, account_status, suspended_until, ban_reason'
      )
      .order('display_name');
    if (error) throw databaseError(error, 'profile list');
    return ((data ?? []) as ProfileRow[])
      .map(toProfile)
      .filter((profile): profile is ProfileRecord => profile !== null);
  }

  async listStaff(): Promise<ProfileRecord[]> {
    const { data, error } = await this.client()
      .from('profiles')
      .select(
        'id, display_name, role, account_status, suspended_until, ban_reason'
      )
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

    if (
      profile.accountStatus !== 'active' &&
      (profile.accountStatus === 'banned' ||
        !profile.suspendedUntil ||
        new Date(profile.suspendedUntil).getTime() > Date.now())
    ) {
      return {
        status: 'account_suspended',
        accountStatus: profile.accountStatus,
        suspendedUntil: profile.suspendedUntil,
        banReason: profile.banReason,
      };
    }

    return {
      status: 'ok',
      context: {
        userId: profile.id,
        email: data.user.email ?? '',
        role: profile.role,
        displayName: profile.displayName,
        accountStatus: profile.accountStatus,
        suspendedUntil: profile.suspendedUntil,
        banReason: profile.banReason,
      },
    };
  }
}
