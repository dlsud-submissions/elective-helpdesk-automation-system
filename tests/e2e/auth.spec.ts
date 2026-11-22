import { expect, test } from '@playwright/test';
import { requireLiveStack, signIn } from './support';

requireLiveStack();

test.describe('sign-in and role routing (S3-01)', () => {
  test('rejects bad credentials without revealing account existence', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('dana.cruz@example.test');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Email or password is incorrect.'
    );
  });

  test('employee lands on chat, keeps the session on reload, and cannot open staff screens', async ({
    page,
  }) => {
    await signIn(page, 'employee');
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole('link', { name: 'Queue' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ask IT' })).toBeVisible();

    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Access denied' })
    ).toBeVisible();
  });

  test('employee API calls to staff endpoints are rejected by the backend', async ({
    page,
  }) => {
    await signIn(page, 'employee');
    const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:3001';
    // Bypass the UI guard and call the API directly with the employee's own
    // session token: the backend must still refuse.
    const status = await page.evaluate(async (api) => {
      const key = Object.keys(localStorage).find((k) =>
        k.endsWith('-auth-token')
      );
      const token = key
        ? JSON.parse(localStorage.getItem(key)!).access_token
        : '';
      const response = await fetch(`${api}/api/analytics/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.status;
    }, apiUrl);
    expect(status).toBe(403);
  });

  test('sign out returns to the sign-in screen', async ({ page }) => {
    await signIn(page, 'agent');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(
      page.getByRole('heading', { name: 'Sign in to get IT help' })
    ).toBeVisible();
    await page.goto('/queue');
    await expect(page).toHaveURL(/\/login$/);
  });
});
