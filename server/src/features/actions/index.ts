import { createActionRouter } from './actions.routes.js';
import { SupabaseActionAuthProvider } from './service/supabase-action-auth.provider.js';
import { SupabaseActionRepository } from './service/supabase-action.repository.js';

export const actionRouter = createActionRouter({
  authProvider: new SupabaseActionAuthProvider(),
  repository: new SupabaseActionRepository(),
  testNotificationSimulationEnabled:
    process.env.ENABLE_TEST_NOTIFICATION_SIMULATION === 'true',
});
