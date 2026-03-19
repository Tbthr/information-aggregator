import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { NEWS_FLASHES } from "@/lib/mock-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const startTime = Date.now()
  const flashes = await prisma.newsFlash.findMany({
    orderBy: [{ createdAt: "desc" }, { time: "desc" }],
    take: 20,
  })

  return NextResponse.json({
    success: true,
    data: {
      newsFlashes:
        flashes.length > 0
          ? flashes.map((flash) => ({
              id: flash.id,
              time: flash.time,
              text: flash.text,
              itemId: flash.itemId,
            }))
          : NEWS_FLASHES,
    },
    meta: {
      timing: {
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      },
    },
  })
}
