import { NextResponse } from "next/server"

import { listItems, parseItemsQuery } from "./_lib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const startTime = Date.now()
  const query = parseItemsQuery(new URL(request.url).searchParams)

  if (!query.success) {
    return NextResponse.json(
      {
        success: false,
        error: query.error,
      },
      { status: 400 }
    )
  }

  const response = await listItems(query.data)

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
