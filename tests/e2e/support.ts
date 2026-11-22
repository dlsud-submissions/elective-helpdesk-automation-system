import { expect, test, type Page } from '@playwright/test';

/** Fictional accounts created by supabase/seed.sql (local only). */
export const accounts = {
  employee: 'dana.cruz@example.test',
  agent: 'lee.agent@example.test',
  admin: 'ari.admin@example.test',
} as const;

const password = process.env.E2E_PASSWORD ?? 'Password123!';

/** Skips the calling spec file unless a running stack is configured. */
export function requireLiveStack(): void {
  test.skip(
    !process.env.E2E_BASE_URL,
    'Set E2E_BASE_URL to run browser E2E tests against a seeded local stack.'
  );
}

export async function signIn(
  page: Page,
  account: keyof typeof accounts,
  path = '/login'
): Promise<void> {
  await page.goto(path);
  await page.getByLabel('Work email').fill(accounts[account]);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}
