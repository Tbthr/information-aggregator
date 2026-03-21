import { after } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "../../../src/utils/logger";

const logger = createLogger("cron");

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * 验证 Cron 请求来源
 * Vercel Cron Jobs 会在请求头中携带 Authorization: Bearer <CRON_SECRET>
 */
export function verifyCronRequest(request: Request): boolean {
  if (!CRON_SECRET) {
    // 开发环境不验证
    if (process.env.NODE_ENV === "development") return true;
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const expected = `Bearer ${CRON_SECRET}`;
  return authHeader === expected;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * 安全包装 after() 回调，记录执行状态到 SchedulerJob 表
 */
export function runAfterJob(jobName: string, fn: () => Promise<void>): void {
  after(async () => {
    try {
      await fn();
      logger.info(`Cron job completed`, { job: jobName });
      await prisma.schedulerJob.upsert({
        where: { id: jobName },
        create: { id: jobName, name: jobName, cron: "", lastRunAt: new Date() },
        update: { lastRunAt: new Date() },
      }).catch(() => {});
    } catch (error) {
      logger.error(`Cron job failed`, {
        job: jobName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
