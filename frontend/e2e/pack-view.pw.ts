import { expect, test } from "@playwright/test";

type PacksResponse = {
  data?: {
    packs?: Array<{
      id: string;
      name: string;
    }>;
  };
};

let samplePackId = "karpathy-picks";
let samplePackName = "";

test.beforeAll(async ({ request }) => {
  const response = await request.get("http://127.0.0.1:3000/api/packs?includeStats=true");
  const payload = (await response.json()) as PacksResponse;
  const firstPack = payload.data?.packs?.[0];

  if (firstPack) {
    samplePackId = firstPack.id;
    samplePackName = firstPack.name;
  }
});

test.describe("Pack View Page", () => {
  test("可加载有效 pack 页面", async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveTitle(/信息聚合器|Information Aggregator/i);
    await expect(page.getByRole("link", { name: /返回列表/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "统计" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "策略配置" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "来源构成" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "代表内容" })).toBeVisible();

    if (samplePackName) {
      await expect(page.getByRole("heading", { level: 1, name: samplePackName })).toBeVisible();
    }
  });

  test("统计卡片会显示 4 个关键指标", async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("来源数")).toBeVisible();
    await expect(page.getByText("总条目")).toBeVisible();
    await expect(page.getByText("保留条目")).toBeVisible();
    await expect(page.getByText("保留率")).toBeVisible();
  });

  test("策略配置区会显示模式标签", async ({ page }) => {
    await page.goto(`/pack/${samplePackId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("模式:")).toBeVisible();
    await expect(page.getByText(/AI 辅助|过滤 \+ AI/)).toBeVisible();
  });

  test("无效 pack ID 会展示兜底状态", async ({ page }) => {
    await page.goto("/pack/invalid-pack-id-12345");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Pack 不存在|加载失败/)).toBeVisible();
  });

  test("items 页面展示 Pack 侧边栏", async ({ page }) => {
    await page.goto("/items");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Packs" })).toBeVisible();
    await expect(page.getByText(/数据源 \(/)).toBeVisible();
  });
});
