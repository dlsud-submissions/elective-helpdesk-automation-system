import { Router, type RequestHandler } from 'express';
import { handle } from '../../shared/http/errors.js';
import { getAuth, requireRole } from './auth.middleware.js';
import type { ProfileDirectory } from './auth.types.js';

function routeId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
import { badRequest } from '../../shared/http/errors.js';
import {
  databaseError,
  getServiceClient,
} from '../../shared/database/index.js';

export function createAuthRouter(deps: {
  requireAuth: RequestHandler;
  profiles: ProfileDirectory;
}): Router {
  const router = Router();

  router.get(
    '/api/me',
    deps.requireAuth,
    handle((request, response) => {
      const auth = getAuth(request);
      response.json({
        profile: {
          id: auth.userId,
          email: auth.email,
          displayName: auth.displayName,
          role: auth.role,
          accountStatus: auth.accountStatus,
          suspendedUntil: auth.suspendedUntil,
          banReason: auth.banReason,
        },
      });
    })
  );

  router.patch(
    '/api/me/profile',
    deps.requireAuth,
    handle(async (request, response) => {
      const body = request.body as Record<string, unknown>;
      if (typeof body.displayName !== 'string') {
        throw badRequest('displayName must be a string.');
      }
      const displayName = body.displayName.trim();
      if (displayName.length < 1 || displayName.length > 120) {
        throw badRequest('Display name must contain 1 to 120 characters.');
      }
      const auth = getAuth(request);
      const { error } = await getServiceClient()
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', auth.userId);
      if (error) throw databaseError(error, 'profile update');
      response.json({
        profile: {
          id: auth.userId,
          email: auth.email,
          displayName,
          role: auth.role,
          accountStatus: auth.accountStatus,
          suspendedUntil: auth.suspendedUntil,
          banReason: auth.banReason,
        },
      });
    })
  );

  router.get(
    '/api/admin/users',
    deps.requireAuth,
    requireRole('admin'),
    handle(async (_request, response) => {
      const profiles = await deps.profiles.listAll();
      const client = getServiceClient();
      const { data, error } = await client.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (error) throw databaseError(error, 'auth user list');

      const authUsers = new Map(
        (data?.users ?? []).map((user) => [
          user.id,
          {
            email: user.email ?? '',
            createdAt: user.created_at,
            lastSignInAt: user.last_sign_in_at ?? null,
            emailConfirmed: Boolean(user.email_confirmed_at),
          },
        ])
      );
      response.json({
        users: profiles.map((profile) => ({
          ...profile,
          ...(authUsers.get(profile.id) ?? {
            email: '',
            createdAt: null,
            lastSignInAt: null,
            emailConfirmed: false,
          }),
        })),
      });
    })
  );

  router.patch(
    '/api/admin/users/:userId/status',
    deps.requireAuth,
    requireRole('admin'),
    handle(async (request, response) => {
      const auth = getAuth(request);
      const userId = routeId(request.params.userId);
      if (userId === auth.userId) {
        throw badRequest('You cannot change the status of your own account.');
      }
      const body = request.body as Record<string, unknown>;
      const action = body.action;
      if (!['suspend', 'ban', 'unsuspend'].includes(String(action))) {
        throw badRequest('Action must be suspend, ban, or unsuspend.');
      }

      const reason =
        typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
      const client = getServiceClient();
      let accountStatus: 'active' | 'suspended' | 'banned';
      let suspendedUntil: string | null = null;
      let banDuration: string | 'none' = 'none';

      if (action === 'suspend') {
        const durationHours = Number(body.durationHours);
        if (
          !Number.isInteger(durationHours) ||
          durationHours < 1 ||
          durationHours > 876000
        ) {
          throw badRequest('Duration must be between 1 hour and 100 years.');
        }
        accountStatus = 'suspended';
        suspendedUntil = new Date(
          Date.now() + durationHours * 60 * 60 * 1000
        ).toISOString();
        banDuration = `${durationHours}h`;
      } else if (action === 'ban') {
        accountStatus = 'banned';
        banDuration = 'none';
      } else {
        accountStatus = 'active';
        banDuration = 'none';
      }

      const { error: authError } = await client.auth.admin.updateUserById(
        userId,
        {
          ban_duration: banDuration,
        }
      );
      if (authError) throw databaseError(authError, 'auth user status update');

      const { error: profileError } = await client
        .from('profiles')
        .update({
          account_status: accountStatus,
          suspended_until: suspendedUntil,
          ban_reason: reason || null,
        })
        .eq('id', userId);
      if (profileError)
        throw databaseError(profileError, 'profile status update');

      response.json({
        user: {
          id: userId,
          accountStatus,
          suspendedUntil,
          banReason: reason || null,
        },
      });
    })
  );

  router.post(
    '/api/admin/users',
    deps.requireAuth,
    requireRole('admin'),
    handle(async (request, response) => {
      const body = request.body as Record<string, unknown>;
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const displayName =
        typeof body.displayName === 'string' ? body.displayName.trim() : '';
      const role = body.role;
      if (!email || !email.includes('@'))
        throw badRequest('A valid email is required.');
      if (password.length < 8)
        throw badRequest('Password must be at least 8 characters.');
      if (!displayName) throw badRequest('Display name is required.');
      if (role !== 'agent' && role !== 'admin') {
        throw badRequest('Role must be agent or admin.');
      }

      const client = getServiceClient();
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (error || !data.user) {
        throw badRequest(error?.message ?? 'The user could not be created.');
      }
      const { error: profileError } = await client.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName,
        role,
      });
      if (profileError) throw databaseError(profileError, 'profile create');
      response.status(201).json({
        user: { id: data.user.id, email, displayName, role },
      });
    })
  );

  router.get(
    '/api/agents',
    deps.requireAuth,
    requireRole('admin'),
    handle(async (_request, response) => {
      const staff = await deps.profiles.listStaff();
      response.json({
        agents: staff.filter((profile) => profile.role === 'agent'),
      });
    })
  );

  return router;
}
