const { test, expect } = require('@playwright/test');

test('displays the page heading', async ({ page }) => {
  await page.setContent('<h1>Welcome to Playwright</h1>');

  await expect(
    page.getByRole('heading', { name: 'Welcome to Playwright' })
  ).toBeVisible();
});
