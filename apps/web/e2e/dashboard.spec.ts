import { expect, test } from '@playwright/test';

test('dashboard loads', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Overview', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Dashboard' })).toBeVisible();
});

test('main navigation opens the specs and rules pages', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Dashboard' });

  for (const name of ['Specs', 'Rules']) {
    await navigation.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
  }
});
