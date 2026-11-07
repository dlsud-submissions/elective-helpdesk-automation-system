import type {
  ActionAuthProvider,
  AuthenticatedUser,
  UserRole,
} from '../types/action.types.js';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

function readConfig(): SupabaseConfig {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } =
    process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase authentication is not configured.');
  }
  return {
    url: SUPABASE_URL.replace(/\/+$/, ''),
    anonKey: SUPABASE_ANON_KEY,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  };
}

export class SupabaseActionAuthProvider implements ActionAuthProvider {
  async authenticate(accessToken: string): Promise<AuthenticatedUser | null> {
    const config = readConfig();
    const authResponse = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (authResponse.status === 401 || authResponse.status === 403) {
      return null;
    }
    if (!authResponse.ok) {
      throw new Error(`Supabase auth returned ${authResponse.status}.`);
    }

    const authUser: unknown = await authResponse.json();
    if (
      typeof authUser !== 'object' ||
      authUser === null ||
      !('id' in authUser) ||
      typeof authUser.id !== 'string'
    ) {
      return null;
    }

    const profileUrl = new URL(`${config.url}/rest/v1/profiles`);
    profileUrl.searchParams.set('id', `eq.${authUser.id}`);
    profileUrl.searchParams.set('select', 'role');
    const profileResponse = await fetch(profileUrl, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!profileResponse.ok) {
      throw new Error(
        `Supabase profile lookup returned ${profileResponse.status}.`
      );
    }

    const profiles: unknown = await profileResponse.json();
    if (!Array.isArray(profiles) || profiles.length !== 1) {
      return null;
    }
    const profile: unknown = profiles[0];
    if (
      typeof profile !== 'object' ||
      profile === null ||
      !('role' in profile) ||
      !isUserRole(profile.role)
    ) {
      return null;
    }

    return { id: authUser.id, role: profile.role };
  }
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'employee' || value === 'agent' || value === 'admin';
}
