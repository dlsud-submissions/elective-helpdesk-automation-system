import { createApp, type AppDependencies } from '../../src/app.js';
import type {
  AuthVerifier,
  ProfileDirectory,
  ProfileRecord,
  VerifyResult,
} from '../../src/features/auth/index.js';
import { InMemoryConversationRepository } from '../../src/features/chat/index.js';
import { InMemoryTicketRepository } from '../../src/features/tickets/index.js';

/** Fictional users. Tokens are opaque test strings, not real JWTs. */
export const users = {
  dana: {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Dana Cruz',
    role: 'employee',
  },
  sam: {
    id: '44444444-4444-4444-8444-444444444444',
    displayName: 'Sam Lim',
    role: 'employee',
  },
  lee: {
    id: '22222222-2222-4222-8222-222222222222',
    displayName: 'Lee Santos',
    role: 'agent',
  },
  ari: {
    id: '33333333-3333-4333-8333-333333333333',
    displayName: 'Ari Reyes',
    role: 'admin',
  },
} satisfies Record<string, ProfileRecord>;

export type TestUser = keyof typeof users;

export const tokenFor = (user: TestUser) => `test-token-${user}`;
export const bearer = (user: TestUser) => `Bearer ${tokenFor(user)}`;

/** Token belonging to a valid auth user who has no profiles row. */
export const NO_PROFILE_TOKEN = 'test-token-no-profile';

export class InMemoryProfileDirectory implements ProfileDirectory {
  private readonly profiles = new Map<string, ProfileRecord>(
    Object.values(users).map((profile) => [profile.id, profile])
  );

  async findById(id: string) {
    return this.profiles.get(id) ?? null;
  }

  async listStaff() {
    return [...this.profiles.values()].filter(
      (profile) => profile.role !== 'employee'
    );
  }
}

export class FakeAuthVerifier implements AuthVerifier {
  constructor(private readonly profiles: ProfileDirectory) {}

  async verify(token: string): Promise<VerifyResult> {
    if (token === NO_PROFILE_TOKEN) return { status: 'no_profile' };
    const key = token.replace('test-token-', '') as TestUser;
    const user = users[key];
    if (!token.startsWith('test-token-') || !user) return { status: 'invalid' };
    const profile = await this.profiles.findById(user.id);
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

export function createTestApp(overrides: Partial<AppDependencies> = {}) {
  const profiles = new InMemoryProfileDirectory();
  const names = (id: string) =>
    Object.values(users).find((user) => user.id === id)?.displayName ?? null;
  const tickets = new InMemoryTicketRepository(names);
  const conversations = new InMemoryConversationRepository();
  const app = createApp({
    profiles,
    authVerifier: new FakeAuthVerifier(profiles),
    tickets,
    conversations,
    ...overrides,
  });
  return { app, tickets, conversations, profiles };
}
