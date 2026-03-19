import { NextResponse } from "next/server"

import { getItemById } from "../_lib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const item = await getItemById(id)

  if (!item) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: item })
}
