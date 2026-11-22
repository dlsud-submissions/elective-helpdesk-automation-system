import { defineConfig, devices } from '@playwright/test';

/**
 * Browser E2E suite. It runs against an already-running stack (local
 * Supabase seeded with supabase/seed.sql, the API, and the Vite client).
 * Every spec is skipped unless E2E_BASE_URL is set, so CI without live
 * services stays green. See README "End-to-end tests".
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
