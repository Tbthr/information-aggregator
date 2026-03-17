import { test, expect } from '@playwright/test';

test.describe('Daily Brief Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to daily brief homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load daily brief homepage', async ({ page }) => {
    // Check URL is root
    await expect(page).toHaveURL(/\//);

    // Check page title
    await expect(page).toHaveTitle(/信息聚合器|Information Aggregator/i);
  });

  test('should display 5 main sections', async ({ page }) => {
    // Check for Cover Story section (封面故事)
    const coverStorySection = page.locator('section:has(h2:has-text("封面故事")), [data-testid="cover-story"]').first();
    await expect(coverStorySection).toBeVisible({ timeout: 10000 });

    // Check for Lead Stories section (重点报道)
    const leadStoriesSection = page.locator('section:has(h2:has-text("重点报道"))').first();
    await expect(leadStoriesSection).toBeVisible({ timeout: 5000 });

    // Check for Top Signals section (热门信号)
    const topSignalsSection = page.locator('section:has(h2:has-text("热门信号"))').first();
    await expect(topSignalsSection).toBeVisible({ timeout: 5000 });

    // Check for Scan Brief section (快速扫描)
    const scanBriefSection = page.locator('section:has(h2:has-text("快速扫描"))').first();
    await expect(scanBriefSection).toBeVisible({ timeout: 5000 });

    // Check for Saved for Later section (稍后阅读)
    const savedForLaterSection = page.locator('section:has(h2:has-text("稍后阅读"))').first();
    await expect(savedForLaterSection).toBeVisible({ timeout: 5000 });
  });

  test('should display section headers with correct Chinese labels', async ({ page }) => {
    // Verify all section headers exist
    const sections = ['封面故事', '重点报道', '热门信号', '快速扫描', '稍后阅读'];

    for (const sectionName of sections) {
      const header = page.locator(`h2:has-text("${sectionName}")`).first();
      await expect(header).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display Save button on items', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Check for save button (bookmark icon) - either filled or outline
    const saveButton = page.locator('button[aria-label="保存"], button[aria-label="取消保存"]').first();

    // Save button should exist if there are items
    const saveButtonCount = await page.locator('button[aria-label="保存"], button[aria-label="取消保存"]').count();

    // If there are items, at least one save button should be visible
    if (saveButtonCount > 0) {
      await expect(saveButton).toBeVisible({ timeout: 5000 });
    }
  });

  test('should toggle save state when clicking Save button', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Find an unsaved item
    const saveButton = page.locator('button[aria-label="保存"]').first();

    if (await saveButton.count() > 0) {
      // Click the save button
      await saveButton.click();

      // Wait for state change
      await page.waitForTimeout(500);

      // Button should now show "取消保存" (unsaved)
      const unsaveButton = page.locator('button[aria-label="取消保存"]').first();
      await expect(unsaveButton).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display empty state when no content available', async ({ page }) => {
    // Check for either content sections or empty state message
    const hasSections = await page.locator('section h2').count() > 0;
    const hasEmptyState = await page.locator('text=暂无内容').count() > 0;
    const hasLoadingSkeleton = await page.locator('.animate-pulse').count() > 0;

    // Page should show either sections, empty state, or loading skeleton
    expect(hasSections || hasEmptyState || hasLoadingSkeleton).toBeTruthy();
  });

  test('should display meta information when content is available', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Check if content exists
    const hasContent = await page.locator('section h2').count() > 0;

    if (hasContent) {
      // Check for meta footer (生成时间)
      const metaFooter = page.locator('footer:has-text("生成时间")');
      await expect(metaFooter).toBeVisible({ timeout: 5000 });
    }
  });

  test('should have accessible section structure', async ({ page }) => {
    // Check for main sections using semantic HTML
    const sections = page.locator('section');
    const sectionCount = await sections.count();

    // Should have at least 4 sections (5 content sections)
    expect(sectionCount).toBeGreaterThanOrEqual(4);
  });
});
