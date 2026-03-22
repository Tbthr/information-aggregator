import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib";
import { createAiClient, loadSettings } from "../../../../src/ai/providers";
import { generateDailyReport } from "../../../../src/reports/daily";
import { createLogger } from "../../../../src/utils/logger";
import { formatUtcDate } from "@/lib/date-utils";

const logger = createLogger("cron:daily");

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const date = formatUtcDate(new Date());

  runAfterJob("daily", async () => {
    try {
      logger.info("Starting daily report generation", { date });

      const settings = await loadSettings();
      if (!settings) {
        logger.warn("AI settings not configured, skipping daily report");
        return;
      }

      const aiClient = await createAiClient();
      if (!aiClient) {
        logger.warn("Failed to create AI client, skipping daily report");
        return;
      }

      const result = await generateDailyReport(date, aiClient);
      logger.info("Daily report generated", { date, itemCount: result.itemCount });
    } catch (error) {
      logger.error("Daily report generation failed", { error: error instanceof Error ? error.message : String(error) });
    }
  });

  return NextResponse.json({ success: true, message: "Daily report job started", date }, { status: 202 });
}
