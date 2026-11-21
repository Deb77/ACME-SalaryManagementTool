import { expect, test } from '@playwright/test';

/** The demo password the e2e server seeds (apps/api/src/test/e2e-server.ts); test-only. */
const PASSWORD = 'e2e-demo-password';

test('Global HR finds someone, records a raise and sees it in their salary history', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('global.hr@demo.acme.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('link', { name: 'Employees' }).first().click();
  const firstPerson = page
    .locator(
      'main a[href^="/employees/"]:not([href="/employees/new"]):not([href="/employees/import"])',
    )
    .first();
  const name = (await firstPerson.innerText()).split('\n')[0]!.trim();
  await page.getByLabel('Search employees').fill(name);
  await page.getByRole('link', { name }).first().click();

  await expect(page.getByRole('heading', { name })).toBeVisible();
  // Desktop shows the history as a table: one header row, then one row per entry, newest first.
  const entries = page.getByRole('table', { name: 'Salary history' }).getByRole('row');
  await expect(entries.nth(1)).toBeVisible();
  const rowsBefore = await entries.count();

  await page.getByRole('button', { name: 'Record salary change' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record salary change' });
  await dialog.getByLabel('New annual salary').fill('150000');
  await dialog.getByLabel('Reason').selectOption({ label: 'Annual review' });
  await dialog.getByRole('button', { name: 'Save change' }).click();

  await expect(dialog).toBeHidden();
  await expect(entries).toHaveCount(rowsBefore + 1);
  // 150,000 in Western grouping or 1,50,000 in Indian grouping, whichever country it is.
  await expect(entries.nth(1)).toContainText('Annual review');
  await expect(entries.nth(1)).toContainText(/1,?50,000/);
});
