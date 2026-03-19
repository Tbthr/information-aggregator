import { NextResponse } from "next/server"

import { getBookmarks } from "../items/_lib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const { items, total } = await getBookmarks()

  return NextResponse.json({
    success: true,
    data: {
      items,
      meta: {
        total,
      },
    },
  })
}
