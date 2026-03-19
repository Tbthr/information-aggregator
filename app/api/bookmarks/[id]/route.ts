import { NextResponse } from "next/server"

import { addBookmark, removeBookmark } from "../../items/_lib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const result = await addBookmark(id)

  if (!result) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: result })
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const deleted = await removeBookmark(id)

  if (!deleted) {
    return NextResponse.json({ success: false, error: "Item not bookmarked" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: { bookmarkedAt: null } })
}
