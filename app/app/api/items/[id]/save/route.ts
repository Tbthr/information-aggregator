import { NextResponse } from "next/server"

import { deleteSavedItemById, saveItemById } from "../../_lib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const result = await saveItemById(id)

  if (!result) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: result })
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const deleted = await deleteSavedItemById(id)

  if (!deleted) {
    return NextResponse.json({ success: false, error: "Item not saved" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: { savedAt: null } })
}
