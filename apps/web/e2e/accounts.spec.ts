import { expect, test } from '@playwright/test';

// The server's environment decides the account mode. Each test accepts the modes that are valid
// for its page, and fails on a blank page or an error.

test('the sign-in page states the account mode', async ({ page }) => {
  const response = await page.goto('/sign-in');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(
    page
      .getByText('This server runs in single-operator mode.')
      .or(page.getByRole('link', { name: 'Sign in with GitHub' }).first())
      .or(page.getByRole('heading', { name: 'Sign-in is not fully configured' })),
  ).toBeVisible();
});

test('an unknown sign-in error code is not echoed', async ({ page }) => {
  await page.goto('/sign-in?error=%3Cscript%3E');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

test('a known sign-in error is explained', async ({ page }) => {
  await page.goto('/sign-in?error=state');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(/sign-in link expired/);
});

test('settings report the account mode', async ({ page }) => {
  await page.goto('/settings');
  const row = page.getByRole('row').filter({ hasText: 'Accounts' });
  await expect(row).toBeVisible();
  await expect(row.getByText(/Single-operator|Sign-in with GitHub|Misconfigured/)).toBeVisible();
});

test('sign-out only accepts POST', async ({ request }) => {
  const response = await request.get('/api/auth/logout', { maxRedirects: 0 });
  expect(response.status()).toBe(405);
});
