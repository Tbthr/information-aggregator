/**
 * 日报生成命令
 */

import { PrismaClient } from "@prisma/client";
import { createAiClient, loadSettings } from "../../ai/providers";
import { generateDailyReport } from "../../reports/daily";

const prisma = new PrismaClient();

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * daily generate 命令
 */
export async function dailyGenerateCommand(dateStr?: string): Promise<void> {
  const date = dateStr || formatDate(new Date());

  console.log(`Generating daily report for ${date}...`);

  // 加载 AI 配置
  const settings = await loadSettings();
  if (!settings) {
    console.log("AI settings not configured");
    await prisma.$disconnect();
    return;
  }
  const aiClient = await createAiClient();
  if (!aiClient) {
    console.log("Failed to create AI client");
    await prisma.$disconnect();
    return;
  }

  // 生成日报
  const result = await generateDailyReport(date, aiClient);

  if (result.itemCount === 0) {
    console.log(`No items found for ${date}`);
  } else {
    console.log(`Daily report generated for ${date}:`);
    console.log(`  Items: ${result.itemCount}`);
  }

  await prisma.$disconnect();
}
