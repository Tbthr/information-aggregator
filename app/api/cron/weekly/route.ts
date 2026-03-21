import { after } from "next/server";
import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse } from "../_lib";
import { createAiClient, loadSettings } from "../../../../src/ai/providers";
import { generateWeeklyReport } from "../../../../src/reports/weekly";
import { createLogger } from "../../../../src/utils/logger";

const logger = createLogger("cron:weekly");

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const date = new Date();

  after(async () => {
    try {
      logger.info("Starting weekly report generation");

      const settings = await loadSettings();
      if (!settings) {
        logger.warn("AI settings not configured, skipping weekly report");
        return;
      }

      const aiClient = await createAiClient();
      if (!aiClient) {
        logger.warn("Failed to create AI client, skipping weekly report");
        return;
      }

      const result = await generateWeeklyReport(date, aiClient);
      logger.info("Weekly report generated", { weekNumber: result.weekNumber, timelineEventCount: result.timelineEventCount });
    } catch (error) {
      logger.error("Weekly report generation failed", { error: error instanceof Error ? error.message : String(error) });
    }
  });

  return NextResponse.json({ success: true, message: "Weekly report job started" }, { status: 202 });
}
