import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  // Check if content exists
  const content = await prisma.content.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!content) {
    return NextResponse.json({ success: false, error: "Content not found" }, { status: 404 })
  }

  // Check if bookmark already exists
  const existingBookmark = await prisma.bookmark.findUnique({
    where: { id }, // Bookmark uses same id as content for unified bookmarking
    select: { bookmarkedAt: true },
  })

  if (existingBookmark) {
    return NextResponse.json({
      success: true,
      data: { bookmarkedAt: existingBookmark.bookmarkedAt.toISOString(), already: true },
    })
  }

  // Create bookmark
  const created = await prisma.bookmark.create({
    data: {
      id, // Use content ID as bookmark ID for unified bookmarking
      contentId: id,
      bookmarkedAt: new Date(),
    },
    select: { bookmarkedAt: true },
  })

  return NextResponse.json({ success: true, data: { bookmarkedAt: created.bookmarkedAt.toISOString() } })
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  const result = await prisma.bookmark.deleteMany({
    where: { contentId: id },
  })

  if (result.count === 0) {
    return NextResponse.json({ success: false, error: "Content not bookmarked" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: { bookmarkedAt: null } })
}
