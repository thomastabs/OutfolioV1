import { expect, test } from '@playwright/test';

test('home page loads and displays the product name', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Outfolio', { exact: true }).first()).toBeVisible();
});
