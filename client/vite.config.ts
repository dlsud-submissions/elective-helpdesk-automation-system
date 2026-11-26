import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const clientEnv = loadEnv(
    mode,
    fileURLToPath(new URL('.', import.meta.url)),
    'VITE_'
  );
  const serverEnvDir = fileURLToPath(new URL('../server/', import.meta.url));
  const serverUrl = loadEnv(mode, serverEnvDir, 'SUPABASE_URL').SUPABASE_URL;
  const serverAnonKey = loadEnv(
    mode,
    serverEnvDir,
    'SUPABASE_ANON_KEY'
  ).SUPABASE_ANON_KEY;

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        serverUrl || clientEnv.VITE_SUPABASE_URL || ''
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        serverAnonKey || clientEnv.VITE_SUPABASE_ANON_KEY || ''
      ),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});
