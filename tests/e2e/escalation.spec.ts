import { expect, test } from '@playwright/test';
import { requireLiveStack, signIn } from './support';

requireLiveStack();

/**
 * S3-07 journey: an employee escalates an unresolved question to a person,
 * sees it in My tickets, and an agent finds the escalated ticket, with its
 * summary and audit history, in the queue.
 */
test.describe('escalation to a human agent', () => {
  test('employee escalates from chat and the agent sees it in the queue', async ({
    page,
  }) => {
    const marker = `payroll export ${Date.now()}`;
    await signIn(page, 'employee');
    await page
      .getByLabel('Describe your IT issue')
      .fill(`Please fix my ${marker}`);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('No approved procedure found')).toBeVisible();

    await page.getByRole('button', { name: 'Talk to a person' }).click();
    await expect(
      page.getByRole('heading', { name: 'Talk to an IT agent' })
    ).toBeFocused();
    await expect(page.getByLabel('Summary for the agent')).toHaveValue(
      new RegExp(marker)
    );
    await page.getByRole('button', { name: 'Send to an IT agent' }).click();

    const confirmation = page.getByText(/Sent to an IT agent as TCK-\d+\./);
    await expect(confirmation).toBeVisible();
    const reference = (await confirmation.textContent())?.match(/TCK-\d+/)?.[0];
    expect(reference).toBeTruthy();

    await page.getByRole('link', { name: 'View my tickets' }).click();
    const mine = page.getByRole('list', { name: 'Your tickets' });
    await expect(mine.getByText(reference!)).toBeVisible();
    await expect(
      mine.getByRole('link', { name: new RegExp(reference!) })
    ).toContainText('Sent to an agent');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'agent');
    await page.getByRole('link', { name: 'Queue' }).click();
    await page.getByLabel('Escalated only').check();
    await page.getByRole('link', { name: new RegExp(reference!) }).click();
    await expect(page.getByText('Escalation summary')).toBeVisible();
    await expect(page.getByText(new RegExp(marker)).first()).toBeVisible();
  });

  test('a ticket created from chat links back to the conversation', async ({
    page,
  }) => {
    await signIn(page, 'employee');
    await page
      .getByLabel('Describe your IT issue')
      .fill(`Payroll portal shows an error ${Date.now()}`);
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('button', { name: 'Create a ticket' }).click();
    await page.getByRole('button', { name: 'Create ticket' }).click();
    await expect(page.getByText(/Ticket TCK-\d+ created\./)).toBeVisible();

    await page.getByRole('link', { name: 'View my tickets' }).click();
    await page
      .getByRole('list', { name: 'Your tickets' })
      .getByRole('link')
      .first()
      .click();
    await page.getByRole('link', { name: 'Open the related chat' }).click();
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
  });
});
