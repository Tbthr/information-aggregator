import { NextRequest, NextResponse } from "next/server"
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib"
import { generateDailyReport } from "../../../../src/reports/daily"

export const runtime = "nodejs"
export const maxDuration = 600

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  runAfterJob("daily", async () => {
    const result = await generateDailyReport(new Date())
    console.log(`[daily-cron] Generated report for ${result.date}: ${result.topicCount} topics, errors: ${result.errorSteps.join(",") || "none"}`)
  })

  return NextResponse.json({ success: true, message: "Daily report generation started" })
}
