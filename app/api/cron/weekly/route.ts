import { NextRequest, NextResponse } from "next/server"
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib"
import { createAiClient } from "../../../../src/ai/providers"
import { generateWeeklyReport } from "../../../../src/reports/weekly"

export const runtime = "nodejs"
export const maxDuration = 3600

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  runAfterJob("weekly", async () => {
    const aiClient = createAiClient()
    if (!aiClient) {
      console.error("[weekly-cron] No AI client available")
      return
    }

    const result = await generateWeeklyReport(new Date(), aiClient)
    console.log(`[weekly-cron] Generated report for ${result.weekNumber}: ${result.pickCount} picks, errors: ${result.errorSteps.join(",") || "none"}`)
  })

  return NextResponse.json({ success: true, message: "Weekly report generation started" })
}
