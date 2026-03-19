/**
 * 周报生成命令
 */

import { PrismaClient } from "@prisma/client";
import { createAiClient, loadSettings } from "../../ai/providers";
import { generateWeeklyReport } from "../../reports/weekly";

const prisma = new PrismaClient();

/**
 * weekly generate 命令
 */
export async function weeklyGenerateCommand(dateStr?: string): Promise<void> {
  const date = dateStr ? new Date(dateStr) : new Date();

  console.log(`Generating weekly report for week of ${date.toISOString().split("T")[0]}...`);

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

  // 生成周报
  const result = await generateWeeklyReport(date, aiClient);

  if (result.timelineEventCount === 0) {
    console.log(`No data found for this week`);
  } else {
    console.log(`Weekly report generated:`);
    console.log(`  Week: ${result.weekNumber}`);
    console.log(`  Timeline events: ${result.timelineEventCount}`);
  }

  await prisma.$disconnect();
}
