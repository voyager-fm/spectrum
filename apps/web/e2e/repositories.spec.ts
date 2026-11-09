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

test('the sidebar switches between the local repository and GitHub repositories', async ({
  page,
}) => {
  await page.goto('/specs');
  await page.getByRole('button', { name: 'Switch repository' }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByText('This server')).toBeVisible();
  await expect(menu.getByText('GitHub', { exact: true })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'All repositories' }).click();
  await expect(page).toHaveURL(/\/repositories$/);
  await expect(page.getByRole('list', { name: 'Getting started' })).toBeVisible();
});

test('a connected repository shows its setup and its specs at one commit', async ({ page }) => {
  await page.goto('/repositories/voyager-fm/spectrum');
  // Without credentials the setup instructions render; with them, live GitHub calls run.
  const setup = page.getByRole('heading', { name: 'Connect a GitHub App' });
  const checklist = page.getByRole('heading', { name: /Spectrum is set up|Set up Spectrum/ });
  await expect(setup.or(checklist)).toBeVisible({ timeout: 30_000 });
  if (await setup.isVisible()) return;

  await page
    .getByRole('navigation', { name: 'Repository' })
    .getByRole('link', { name: 'Specs' })
    .click();
  await expect(page).toHaveURL(/\/repositories\/voyager-fm\/spectrum\/specs$/);
  await expect(page.getByText(/^At [0-9a-f]{7} from/)).toBeVisible({ timeout: 30_000 });
  const first = page.getByRole('table').getByRole('link').first();
  const id = (await first.textContent())?.trim() ?? '';
  await first.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Acceptance criteria' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(id, { exact: true }).first()).toBeVisible();
});
