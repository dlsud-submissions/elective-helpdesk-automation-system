import { expect, test } from '@playwright/test';
import { requireLiveStack, signIn } from './support';

requireLiveStack();

test.describe('agent/admin queue and dashboard (S3-06)', () => {
  test('agent sees the seeded escalated ticket first and updates it', async ({
    page,
  }) => {
    await signIn(page, 'agent');
    await expect(page).toHaveURL(/\/queue$/);

    const list = page.getByRole('list', { name: 'Tickets' });
    await expect(list.getByRole('link').first()).toContainText('Escalated');
    await list.getByRole('link').first().click();

    const detail = page.getByRole('region', { name: 'Ticket detail' });
    await expect(
      detail.getByText(/AI-generated, check before acting/)
    ).toBeVisible();

    const status = detail.getByLabel('Status');
    const options = await status.locator('option').allTextContents();
    const currentValue = await status.inputValue();
    const currentLabel = await status
      .locator(`option[value="${currentValue}"]`)
      .textContent();
    const next = options.find((option) => option !== currentLabel);
    test.skip(!next, 'Seeded ticket has no further transitions.');
    await status.selectOption({ label: next! });
    await detail
      .getByLabel('Assigned to')
      .selectOption({ label: 'Lee Santos' });
    await detail.getByRole('button', { name: 'Save' }).click();
    await expect(detail.getByRole('status')).toContainText('Saved.');
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
