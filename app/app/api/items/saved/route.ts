import { NextResponse } from "next/server"

import { getSavedItems } from "../_lib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const { items, total } = await getSavedItems()

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
