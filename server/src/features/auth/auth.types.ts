export type AppRole = 'employee' | 'agent' | 'admin';

export const appRoles: readonly AppRole[] = ['employee', 'agent', 'admin'];

/** Verified caller identity. Role always comes from public.profiles. */
export type AuthContext = {
  userId: string;
  role: AppRole;
  displayName: string;
};

export type ProfileRecord = {
  id: string;
  displayName: string;
  role: AppRole;
};

export type VerifyResult =
  | { status: 'ok'; context: AuthContext }
  | { status: 'invalid' }
  | { status: 'no_profile' };

export interface AuthVerifier {
  verify(accessToken: string): Promise<VerifyResult>;
}

export interface ProfileDirectory {
  findById(id: string): Promise<ProfileRecord | null>;
  listStaff(): Promise<ProfileRecord[]>;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}
