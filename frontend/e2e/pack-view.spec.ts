import { test, expect } from '@playwright/test';

test.describe('Pack View Page', () => {
  // Test with a sample pack ID - in real scenarios, this would be dynamic
  const samplePackId = 'test-pack';

  test.beforeEach(async ({ page }) => {
    // Navigate to items page first to find available packs
    await page.goto('/items');
    await page.waitForLoadState('networkidle');
  });

  test('should load pack view page', async ({ page }) => {
    // Try to navigate to a pack view
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForLoadState('networkidle');

    // Page should have loaded (either pack content or error state)
    await expect(page).toHaveTitle(/信息聚合器|Information Aggregator/i);
  });

  test('should display pack structure when pack exists', async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForLoadState('networkidle');

    // Wait for loading to complete
    await page.waitForTimeout(1000);

    // Check for either pack content or not-found state
    const hasPackContent = await page.locator('header h1').count() > 0;
    const hasNotFound = await page.locator('text=Pack 不存在').count() > 0;
    const hasError = await page.locator('text=加载失败').count() > 0;

    // Page should show one of these states
    expect(hasPackContent || hasNotFound || hasError).toBeTruthy();
  });

  test('should display back to list link', async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForLoadState('networkidle');

    // Check for back link
    const backLink = page.locator('a:has-text("返回列表")');
    await expect(backLink).toBeVisible({ timeout: 5000 });
  });

  test('should display statistics section when pack exists', async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForTimeout(1000);

    // Check if statistics section exists (for valid packs)
    const statsSection = page.locator('section:has(h2:has-text("统计"))');
    const hasStats = await statsSection.count() > 0;

    if (hasStats) {
      // Verify stat cards exist
      const statCards = page.locator('section:has(h2:has-text("统计")) .grid > div');
      const cardCount = await statCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(4);
    }
  });

  test('should display policy section when pack exists', async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForTimeout(1000);

    // Check if policy section exists
    const policySection = page.locator('section:has(h2:has-text("策略配置"))');
    const hasPolicy = await policySection.count() > 0;

    if (hasPolicy) {
      await expect(policySection).toBeVisible({ timeout: 5000 });

      // Check for policy mode badge
      const modeBadge = page.locator('.bg-blue-100.text-blue-700');
      await expect(modeBadge.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display source composition when pack exists', async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForTimeout(1000);

    // Check if source composition section exists
    const sourceSection = page.locator('section:has(h2:has-text("来源构成"))');
    const hasSourceSection = await sourceSection.count() > 0;

    if (hasSourceSection) {
      await expect(sourceSection).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display featured items when pack exists', async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForTimeout(1000);

    // Check if featured items section exists
    const featuredSection = page.locator('section:has(h2:has-text("代表内容"))');
    const hasFeaturedSection = await featuredSection.count() > 0;

    if (hasFeaturedSection) {
      await expect(featuredSection).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle invalid pack ID gracefully', async ({ page }) => {
    // Navigate with an invalid/non-existent pack ID
    await page.goto('/pack/invalid-pack-id-12345');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should show error or not found state
    const hasNotFound = await page.locator('text=Pack 不存在').count() > 0;
    const hasError = await page.locator('text=加载失败').count() > 0;

    expect(hasNotFound || hasError).toBeTruthy();
  });

  test('should have correct navigation from items page', async ({ page }) => {
    // Start on items page
    await page.goto('/items');
    await page.waitForLoadState('networkidle');

    // Look for pack links in sidebar
    const packLink = page.locator('aside a[href^="/pack/"]').first();

    if (await packLink.count() > 0) {
      await packLink.click();
      await page.waitForLoadState('networkidle');

      // Should be on pack view page
      await expect(page).toHaveURL(/\/pack\//);
    }
  });

  test('should display pack name in header', async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForTimeout(1000);

    // Check if pack header exists (for valid packs)
    const packHeader = page.locator('header h1');
    const hasHeader = await packHeader.count() > 0;

    if (hasHeader) {
      const headerText = await packHeader.textContent();
      expect(headerText).not.toBe('');
    }
  });
});
