import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { DEEP_DIVES, TIMELINE_EVENTS, WEEKLY_HERO } from "@/lib/mock-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const startTime = Date.now()
  const report = await prisma.weeklyReport.findFirst({
    include: {
      timelineEvents: {
        orderBy: [{ order: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    success: true,
    data: {
      hero: report
        ? {
            weekNumber: report.weekNumber,
            headline: report.headline,
            subheadline: report.subheadline ?? "",
            editorial: report.editorial ?? "",
          }
        : WEEKLY_HERO,
      timelineEvents:
        report?.timelineEvents.length
          ? report.timelineEvents.map((event) => ({
              id: event.id,
              date: event.date,
              dayLabel: event.dayLabel,
              title: event.title,
              summary: event.summary,
            }))
          : TIMELINE_EVENTS,
      deepDives: DEEP_DIVES,
    },
    meta: {
      timing: {
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      },
    },
  })
}
