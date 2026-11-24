import { expect, test } from '@playwright/test';
import { requireLiveStack, signIn } from './support';

requireLiveStack();

/** Employee ticket handoff: admin assignment, agent reply, and resolution. */
test.describe('employee ticket handoff', () => {
  test('admin assigns a chat ticket and the agent replies and resolves it', async ({
    page,
  }) => {
    const marker = `printer issue ${Date.now()}`;
    await signIn(page, 'employee');
    await page
      .getByLabel('Describe your IT issue')
      .fill(`The printer is offline ${marker}`);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('No approved procedure found')).toBeVisible();

    await page.getByRole('button', { name: 'Create a ticket' }).click();
    await page.getByLabel('Title').fill(marker);
    await page
      .getByLabel('Description')
      .fill(`The printer is offline: ${marker}`);
    await page.getByRole('button', { name: 'Create ticket' }).click();

    const confirmation = page.getByText(/Ticket TCK-\d+ created\./);
    await expect(confirmation).toBeVisible();
    const reference = (await confirmation.textContent())?.match(/TCK-\d+/)?.[0];
    expect(reference).toBeTruthy();

    await page.getByRole('link', { name: 'View my tickets' }).click();
    const mine = page.getByRole('list', { name: 'Your tickets' });
    await expect(mine.getByText(reference!)).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'admin');
    await page.getByRole('link', { name: 'Queue' }).click();
    await page
      .getByRole('list', { name: 'Tickets' })
      .getByRole('link', { name: new RegExp(reference!) })
      .click();
    const adminDetail = page.getByRole('region', { name: 'Ticket detail' });
    await adminDetail
      .getByLabel('Assigned to')
      .selectOption({ label: 'Lee Santos' });
    await adminDetail.getByRole('button', { name: 'Save' }).click();
    await expect(adminDetail.getByRole('status')).toContainText(
      'assigned to Lee Santos'
    );

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'agent');
    await page
      .getByRole('list', { name: 'Assigned tickets' })
      .getByRole('link', { name: new RegExp(reference!) })
      .click();
    await page
      .getByLabel('Solution or follow-up')
      .fill(`Resolved the issue: ${marker}`);
    await page.getByRole('button', { name: 'Send solution' }).click();
    await expect(page.getByText('Reply sent to the requester.')).toBeVisible();
    await page.getByLabel('Status').selectOption({ label: 'In progress' });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('Saved.');
    await page.getByLabel('Status').selectOption({ label: 'Resolved' });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('Resolved');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'employee');
    await page.getByRole('link', { name: 'My tickets' }).click();
    await page
      .getByRole('list', { name: 'Your tickets' })
      .getByRole('link', { name: new RegExp(reference!) })
      .click();
    await page.getByRole('link', { name: 'Open the related chat' }).click();
    await expect(page.getByText(`Resolved the issue: ${marker}`)).toBeVisible();
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
