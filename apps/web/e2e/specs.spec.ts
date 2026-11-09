import { expect, test } from '@playwright/test';

test('the spec index filters interactions and keeps the filter in the URL', async ({ page }) => {
  await page.goto('/specs');
  await expect(page.getByRole('heading', { level: 1, name: 'Specs', exact: true })).toBeVisible();
  const count = page.getByText(/^\d+ of \d+$/);
  const [total] = ((await count.textContent()) ?? '').match(/\d+$/) ?? [];

  // A click before hydration does nothing, so retry until the menu opens.
  const implementing = page.getByRole('menuitemcheckbox', { name: /implementing/ });
  await expect(async () => {
    await page.getByRole('button', { name: 'Lifecycle' }).click();
    await expect(implementing).toBeVisible({ timeout: 1000 });
  }).toPass();
  await implementing.click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/[?&]lifecycle=implementing/);
  await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('implementing');
  await expect(count).not.toHaveText(`${total} of ${total}`);

  await page.getByRole('textbox', { name: 'Filter by text' }).fill('no interaction is named this');
  await expect(page.getByText('No interaction matches these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(count).toHaveText(`${total} of ${total}`);
  await expect(page).toHaveURL(/\/specs$/);
});

test('a spec reads as a document with its outline, criteria and related links', async ({
  page,
}) => {
  await page.goto('/specs');
  const first = page.getByRole('table').first().getByRole('link').first();
  const title = (await first.textContent())?.trim() ?? '';
  await first.click();

  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Intent' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Acceptance criteria' })).toBeVisible();
  await expect(page.getByText('Not recorded').first()).toBeVisible();
  // Declared lifecycle, document status and the structural check stay separate values.
  for (const label of ['Lifecycle', 'Document status', 'Structural check'])
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();

  const tree = page.getByRole('navigation', { name: 'Specifications' });
  await expect(tree.locator('[aria-current="page"]')).toHaveText(title);

  const outline = page.getByRole('link', { name: 'Acceptance Criteria', exact: true }).first();
  await outline.click();
  await expect(page).toHaveURL(/#acceptance-criteria$/);
});

test('linked contracts and flows open inside the reader', async ({ page }) => {
  await page.goto('/specs');
  await page
    .getByRole('group', { name: 'Document kind' })
    .getByRole('button', { name: /^Contracts/ })
    .click();
  const contract = page.getByRole('table').nth(1).getByRole('link').first();
  const name = (await contract.textContent())?.trim() ?? '';
  await contract.click();
  await expect(page).toHaveURL(/\/specs\/documents\/.+\.toml$/);
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
  // The rail renders beside the page on wide screens and below it on narrow ones.
  await expect(
    page.getByRole('heading', { name: /^Linked from \(\d+\)$/ }).filter({ visible: true }),
  ).toBeVisible();
});

test('the command palette finds a spec by acceptance criterion text', async ({ page }) => {
  await page.goto('/specs');
  const input = page.getByRole('combobox', { name: 'Search specs' });
  // A click before hydration does nothing, so retry until the dialog opens.
  await expect(async () => {
    await page.getByRole('button', { name: 'Search specs' }).click();
    await expect(input).toBeVisible({ timeout: 1000 });
  }).toPass();
  await input.fill('checked boxes');
  const option = page.getByRole('option').first();
  await expect(option).toBeVisible();
  await input.press('Enter');
  await expect(page).toHaveURL(/\/specs\/[A-Z]+-\d{3}-/);
  await expect(page.getByRole('heading', { level: 2, name: 'Acceptance criteria' })).toBeVisible();
});

test('an unknown spec or document is not found', async ({ page }) => {
  expect((await page.goto('/specs/NOPE-000-missing'))?.status()).toBe(404);
  expect((await page.goto('/specs/documents/.spectrum/missing.md'))?.status()).toBe(404);
});
