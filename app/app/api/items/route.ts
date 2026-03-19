import { NextResponse } from "next/server"

import { listItems, parseItemsQuery } from "./_lib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const startTime = Date.now()
  const query = parseItemsQuery(new URL(request.url).searchParams)
  const response = await listItems(query)

  return NextResponse.json({
    ...response,
    meta: {
      ...response.meta,
      timing: {
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      },
    },
  })
}
