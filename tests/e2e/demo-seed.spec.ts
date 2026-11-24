import { expect, test } from '@playwright/test';
import { requireLiveStack, signIn } from './support';

requireLiveStack();

test.describe('repeatable fictional demo seed', () => {
  test('provides the supported employee, agent, and admin demo journeys', async ({
    page,
  }) => {
    await signIn(page, 'employee');
    await expect(page).toHaveURL(/\/chat$/);

    await page
      .getByLabel('Describe your IT issue')
      .fill('How do I reset MFA after losing my phone?');
    await page.getByRole('button', { name: 'Send' }).click();
    const log = page.getByRole('log');
    await expect(log.getByRole('heading', { name: 'Sources' })).toBeVisible();
    await expect(log.getByText('MFA reset procedures').first()).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'agent');
    await expect(
      page.getByRole('heading', { name: 'Agent dashboard' })
    ).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Assigned tickets' }).getByRole('link')
    ).toHaveCount(3);
    await expect(page.getByText('Open unassigned')).toHaveCount(0);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'admin');
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(
      page
        .getByRole('list', { name: 'Key metrics' })
        .getByText('Open escalations')
    ).toBeVisible();
  });
});
