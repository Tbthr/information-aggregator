import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tweet = await prisma.tweet.findUnique({ where: { id } });
  if (!tweet) {
    return NextResponse.json({ success: false, error: "Tweet not found" }, { status: 404 });
  }
  const bookmark = await prisma.tweetBookmark.upsert({
    where: { tweetId: id },
    create: { tweetId: id },
    update: {},
  });
  return NextResponse.json({ success: true, data: { bookmarkedAt: bookmark.bookmarkedAt.toISOString() } });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deleted = await prisma.tweetBookmark.deleteMany({ where: { tweetId: id } });
  if (deleted.count === 0) {
    return NextResponse.json({ success: false, error: "Not bookmarked" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { bookmarkedAt: null } });
}
