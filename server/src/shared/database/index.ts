export type DatabaseConfig = {
  url: string;
  serviceRoleKey: string;
  isConfigured: boolean;
};

export function getDatabaseConfig(): DatabaseConfig {
  const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'local-dev-service-role';

  return {
    url,
    serviceRoleKey,
    isConfigured: Boolean(url && serviceRoleKey),
  };
}

export function createDatabaseClient() {
  const config = getDatabaseConfig();

  return {
    config,
    query: async <T>(statement: string, params?: unknown[]): Promise<T[]> => {
      void statement;
      void params;

      return [] as T[];
    },
  };
}
