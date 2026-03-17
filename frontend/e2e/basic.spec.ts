import { test, expect } from '@playwright/test';

test.describe('Daily Brief Page', () => {
  test('should load daily brief homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to be ready
    await page.waitForLoadState('networkidle');

    // Check that the page loaded with a title
    await expect(page).toHaveTitle(/信息聚合器|Information Aggregator/i);

    // Check that the main content area exists
    const mainContent = page.locator('main, [role="main"], .daily-brief');
    await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display header or navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for header element
    const header = page.locator('header, [role="banner"], nav');
    await expect(header.first()).toBeVisible();
  });
});
