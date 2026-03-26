import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib";
import { runCollectJob } from "../../../../src/pipeline/run-collect-job";
import { createLogger } from "../../../../src/utils/logger";

const logger = createLogger("cron:collect");

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  runAfterJob("collect", async () => {
    try {
      await runCollectJob({ logger });
      logger.info("Collect job completed");
    } catch (error) {
      logger.error("Collect job failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return NextResponse.json({ success: true, message: "Collect job started" }, { status: 202 });
}
