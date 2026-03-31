import { NextRequest, NextResponse } from "next/server"
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib"
import { generateDailyReport } from "../../../../src/reports/daily"
import { createAiClient } from "@/src/ai/client"

export const runtime = "nodejs"
export const maxDuration = 600

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  runAfterJob("daily", async () => {
    const aiClient = createAiClient()
    if (!aiClient) {
      console.error("[daily-cron] No AI client available")
      return
    }

    const result = await generateDailyReport(new Date(), aiClient)
    console.log(`[daily-cron] Generated report for ${result.date}: ${result.topicCount} topics, errors: ${result.errorSteps.join(",") || "none"}`)
  })

  return NextResponse.json({ success: true, message: "Daily report generation started" })
}
