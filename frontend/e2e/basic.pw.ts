import { expect, test } from "@playwright/test";

test.describe("Daily Brief Smoke", () => {
  test("首页可加载并显示主模块", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveTitle(/信息聚合器|Information Aggregator/i);
    await expect(page.getByRole("heading", { name: "封面故事" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "重点报道" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "热门信号" })).toBeVisible();
  });

  test("首页存在保存交互入口", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const saveButtons = page.getByRole("button", { name: /保存|取消保存/ });
    await expect(saveButtons.first()).toBeVisible();
  });
});
