import { expect, test } from "@playwright/test";

const SECTION_TITLES = ["封面故事", "重点报道", "热门信号", "快速扫描", "稍后阅读"] as const;

test.describe("Daily Brief Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("首页标题与 URL 正确", async ({ page }) => {
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle(/信息聚合器|Information Aggregator/i);
  });

  test("展示 5 个主模块标题", async ({ page }) => {
    for (const title of SECTION_TITLES) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });

  test("存在保存按钮", async ({ page }) => {
    const saveButtons = page.getByRole("button", { name: /保存|取消保存/ });
    await expect(saveButtons.first()).toBeVisible();
  });

  test("点击保存按钮后状态会切换", async ({ page }) => {
    const saveButton = page.getByRole("button", { name: "保存" }).first();
    const unsaveButton = page.getByRole("button", { name: "取消保存" }).first();

    if (await saveButton.count()) {
      await saveButton.click();
      await expect(unsaveButton).toBeVisible({ timeout: 5000 });
      return;
    }

    await expect(unsaveButton).toBeVisible();
    await unsaveButton.click();
    await expect(page.getByRole("button", { name: "保存" }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("显示生成元信息", async ({ page }) => {
    await expect(page.getByText("生成时间:", { exact: false })).toBeVisible();
    await expect(page.getByText("总条目:", { exact: false })).toBeVisible();
    await expect(page.getByText("保留率:", { exact: false })).toBeVisible();
  });

  test("快速扫描模块至少渲染一条链接", async ({ page }) => {
    const scanBriefHeading = page.getByRole("heading", { name: "快速扫描" });
    await expect(scanBriefHeading).toBeVisible();

    const scanLinks = page.locator("section").filter({ has: scanBriefHeading }).locator("a");
    await expect(scanLinks.first()).toBeVisible();
  });
});
