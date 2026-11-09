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

test('runs remains planned while execution is unavailable', async ({ page }) => {
  const response = await page.goto('/runs');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Runs', exact: true })).toBeVisible();
  const plannedRuns = page.getByRole('region', { name: /Agent runs/ });
  await expect(plannedRuns.getByText('Not implemented', { exact: true })).toBeVisible();
  await expect(plannedRuns.getByRole('button')).toHaveCount(0);
});

test('integrations report connection state, not configuration flags', async ({ page }) => {
  const response = await page.goto('/settings');

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Integrations', exact: true }),
  ).toBeVisible();
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader')).toHaveText([
    'Integration',
    'Connection',
    'Purpose',
  ]);
  const github = table.getByRole('row', { name: /^GitHub/ });
  await expect(github.getByText(/^(App configured|Not configured)$/)).toBeVisible();
  const linear = table.getByRole('row', { name: /^Linear/ });
  await expect(linear.getByText('Not implemented', { exact: true })).toBeVisible();
  await expect(page.getByText(/^(enabled|disabled)$/)).toHaveCount(0);
});

test('overview leaves planned agent loop pages to one sidebar group', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Agent loop' })).toHaveCount(0);
  const navigation = page.getByRole('navigation', { name: 'Dashboard' });
  await expect(navigation.getByRole('link', { name: 'Runs', exact: true })).toBeHidden();
  await navigation.getByText('Agent loop', { exact: true }).click();
  await navigation.getByRole('link', { name: 'Runs', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Runs', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Runs', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
