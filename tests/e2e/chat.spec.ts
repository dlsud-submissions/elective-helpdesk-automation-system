import { expect, test } from '@playwright/test';
import { requireLiveStack, signIn } from './support';

requireLiveStack();

test.describe('employee chat (S3-02, S3-03)', () => {
  test('asks a supported question and sees a cited answer that survives reload', async ({
    page,
  }) => {
    await signIn(page, 'employee');
    const question = `How do I reset MFA after losing my phone? (${Date.now()})`;
    await page.getByLabel('Describe your IT issue').fill(question);
    await page.getByRole('button', { name: 'Send' }).click();

    const log = page.getByRole('log');
    await expect(log.getByText(question)).toBeVisible();
    await expect(log.getByRole('heading', { name: 'Sources' })).toBeVisible();
    await expect(log.getByText('MFA reset procedures').first()).toBeVisible();
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);

    await page.reload();
    await expect(page.getByRole('log').getByText(question)).toBeVisible();
  });

  test('unsupported question is uncertain and can become a ticket', async ({
    page,
  }) => {
    await signIn(page, 'employee');
    await page
      .getByLabel('Describe your IT issue')
      .fill('Please change my payroll bank account details');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('No approved procedure found')).toBeVisible();
    await page.getByRole('button', { name: 'Create a ticket' }).click();
    await page.getByRole('button', { name: 'Create ticket' }).click();
    await expect(page.getByText(/Ticket TCK-\d+ created\./)).toBeVisible();
  });

  test('warns before sending something that looks like a password', async ({
    page,
  }) => {
    await signIn(page, 'employee');
    await page
      .getByLabel('Describe your IT issue')
      .fill('my password is Winter2026!');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(
      page.getByText(/This looks like a password or secret code/)
    ).toBeVisible();
    await expect(page.getByRole('log').getByText('Winter2026!')).toHaveCount(0);
  });
});
