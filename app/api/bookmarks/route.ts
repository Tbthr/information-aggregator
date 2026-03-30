import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const rows = await prisma.bookmark.findMany({
    where: {
      contentId: { not: null },
    },
    orderBy: {
      bookmarkedAt: "desc",
    },
  })

  const contents = await prisma.content.findMany({
    where: {
      id: { in: rows.map((r) => r.contentId).filter((id): id is string => id !== null) },
    },
  })

  const contentMap = new Map(contents.map((c) => [c.id, c]))

  const items = rows
    .map((bookmark) => {
      const content = bookmark.contentId ? contentMap.get(bookmark.contentId) : null
      if (!content) return null
      return {
        id: content.id,
        title: content.title,
        url: content.url,
        source: content.sourceId,
        publishedAt: content.publishedAt ? content.publishedAt.toISOString() : null,
        fetchedAt: content.fetchedAt.toISOString(),
        author: content.authorLabel,
        isBookmarked: true,
        saved: {
          savedAt: bookmark.bookmarkedAt.toISOString(),
        },
      }
    })
    .filter(Boolean)

  return NextResponse.json({
    success: true,
    data: {
      items,
      meta: {
        total: items.length,
      },
    },
  })
}
