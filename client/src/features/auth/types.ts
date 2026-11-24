export type AppRole = 'employee' | 'agent' | 'admin';

/** Profile returned by GET /api/me. Role is authoritative from public.profiles. */
export type Profile = {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  accountStatus: 'active' | 'suspended' | 'banned';
  suspendedUntil: string | null;
  banReason: string | null;
};

export type SignedOutNotice = 'expired' | 'noProfile' | 'signedOut';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice?: SignedOutNotice }
  | { status: 'signedIn'; profile: Profile }
  | { status: 'error'; message: string };

export type SignInResult = { ok: true } | { ok: false; message: string };

export const isStaff = (role: AppRole) => role === 'agent' || role === 'admin';

export const homePathFor = (role: AppRole) => {
  switch (role) {
    case 'employee':
      return '/chat';
    case 'agent':
      return '/dashboard';
    case 'admin':
      return '/queue';
  }
};
