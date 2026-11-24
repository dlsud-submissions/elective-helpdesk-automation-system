import { expect, test } from '@playwright/test';
import { requireLiveStack, signIn } from './support';

requireLiveStack();

/**
 * S4-06 keyboard-only and narrow-viewport regressions. Runs in both the
 * desktop and mobile (Pixel 7) Playwright projects.
 */
test.describe('keyboard and responsive checks (S4-06)', () => {
  test('skip link, keyboard send, and no horizontal overflow in chat', async ({
    page,
  }) => {
    await signIn(page, 'employee');
    await expect(page).toHaveTitle('Chat · Harbor Tickets');

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');

    const input = page.getByLabel('Describe your IT issue');
    await input.focus();
    await input.fill(
      `How do I reset MFA? https://example.test/${'very-long-path-'.repeat(12)}`
    );
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('log').getByRole('heading', { name: 'Sources' })
    ).toBeVisible();
    await expect(input).toBeFocused();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('agent opens a ticket by keyboard and focus lands on its heading', async ({
    page,
  }) => {
    await signIn(page, 'agent');
    await expect(page).toHaveTitle('Agent dashboard · Harbor Tickets');
    const firstTicket = page
      .getByRole('list', { name: 'Assigned tickets' })
      .getByRole('link')
      .first();
    await firstTicket.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ticket-title')).toBeFocused();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('employees are denied the admin queue by direct navigation', async ({
    page,
  }) => {
    await signIn(page, 'employee');
    await page.goto('/queue');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Access denied' })
    ).toBeVisible();
  });
});
