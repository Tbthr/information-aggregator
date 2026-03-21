import { after } from "next/server";
import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse } from "../_lib";
import { createAiClient, loadSettings } from "../../../../src/ai/providers";
import { generateDailyReport } from "../../../../src/reports/daily";
import { createLogger } from "../../../../src/utils/logger";

const logger = createLogger("cron:daily");

export const runtime = "nodejs";
export const maxDuration = 300;

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const date = formatDate(new Date());

  after(async () => {
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
