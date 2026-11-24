import { expect, test } from '@playwright/test';
import { requireLiveStack, signIn } from './support';

requireLiveStack();

test.describe('agent dashboard and admin queue (S3-06)', () => {
  test('admin assigns the seeded ticket and the agent resolves it', async ({
    page,
  }) => {
    await signIn(page, 'admin');
    await page.getByRole('link', { name: 'Queue' }).click();
    const queue = page.getByRole('list', { name: 'Tickets' });
    await queue
      .getByRole('link')
      .filter({ hasText: 'VPN drops on home network' })
      .click();
    const adminDetail = page.getByRole('region', { name: 'Ticket detail' });
    await adminDetail
      .getByLabel('Assigned to')
      .selectOption({ label: 'Lee Santos' });
    await adminDetail.getByRole('button', { name: 'Save' }).click();
    await expect(adminDetail.getByRole('status')).toContainText('Saved.');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'agent');
    await expect(page).toHaveURL(/\/dashboard$/);

    const list = page.getByRole('list', { name: 'Assigned tickets' });
    const assignedTicket = list
      .getByRole('link')
      .filter({ hasText: 'VPN drops on home network' });
    await expect(assignedTicket).toBeVisible();
    await assignedTicket.click();

    const detail = page.getByRole('article', {
      name: 'VPN drops on home network',
    });
    await expect(
      detail.getByText(/AI-generated, check before acting/)
    ).toBeVisible();

    const status = detail.getByLabel('Status');
    await status.selectOption({ label: 'In progress' });
    await detail.getByRole('button', { name: 'Save' }).click();
    await expect(detail.getByRole('status')).toContainText('Saved.');
    await expect(detail.getByLabel('Assigned to')).toHaveCount(0);
  });

  test('admin dashboard shows server-calculated metrics', async ({ page }) => {
    await signIn(page, 'admin');
    await page.getByRole('link', { name: 'Dashboard' }).click();
    const tiles = page.getByRole('list', { name: 'Key metrics' });
    await expect(tiles).toBeVisible();
    await expect(tiles.getByText('Open escalations')).toBeVisible();
    await expect(
      page.getByRole('table', { name: /Tickets by current status/ })
    ).toBeVisible();
  });
});
