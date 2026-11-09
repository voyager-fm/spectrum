import { expect, test } from '@playwright/test';

test('repositories page shows the GitHub setup or the connected repositories', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await page
    .getByRole('navigation', { name: 'Dashboard' })
    .getByRole('link', { name: 'Repositories', exact: true })
    .click();

  await expect(page.getByRole('heading', { level: 1, name: 'Repositories' })).toBeVisible();
  // Live credentials decide which state renders; both are valid, a blank page is not.
  // With credentials the page waits on live GitHub calls, so allow a longer timeout.
  await expect(
    page
      .getByRole('heading', { name: 'Connect a GitHub App' })
      .or(page.getByText(/\d+ installations?, \d+ repositor(y|ies)/)),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('textbox', { name: 'Repository' })).toBeVisible();
});

test('an invalid repository name is reported, not checked', async ({ page }) => {
  await page.goto('/repositories?repository=not-a-repository');
  await expect(page.getByText('is not a repository name')).toBeVisible();
});
