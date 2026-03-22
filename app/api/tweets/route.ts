import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "bookmarks";
  const window = searchParams.get("window") || "week";
  const sort = searchParams.get("sort") || "ranked";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const search = searchParams.get("search") || "";

  const now = new Date();
  const windowMap: Record<string, number> = {
    today: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };
  const windowMs = windowMap[window] || windowMap.week;
  const since = new Date(now.getTime() - windowMs);

  const where: Record<string, unknown> = { tab, fetchedAt: { gte: since } };
  if (search) {
    where.OR = [
      { text: { contains: search, mode: "insensitive" } },
      { authorHandle: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: Record<string, string> =
    sort === "engagement"
      ? { likeCount: "desc" }
      : sort === "recent"
        ? { fetchedAt: "desc" }
        : { score: "desc" };

  const [tweets, total] = await Promise.all([
    prisma.tweet.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { bookmarks: true },
    }),
    prisma.tweet.count({ where }),
  ]);

  const allBookmarks = await prisma.tweetBookmark.findMany({ select: { tweetId: true } });
  const bookmarkedIds = new Set(allBookmarks.map((b) => b.tweetId));

  const items = tweets.map((t) => ({
    id: t.id,
    tweetId: t.tweetId,
    tab: t.tab,
    text: t.text,
    url: t.url,
    expandedUrl: t.expandedUrl,
    publishedAt: t.publishedAt?.toISOString(),
    fetchedAt: t.fetchedAt.toISOString(),
    authorHandle: t.authorHandle,
    authorName: t.authorName,
    likeCount: t.likeCount,
    replyCount: t.replyCount,
    retweetCount: t.retweetCount,
    summary: t.summary,
    bullets: t.bullets,
    categories: t.categories,
    score: t.score,
    isBookmarked: bookmarkedIds.has(t.id),
    media: t.mediaJson ? JSON.parse(t.mediaJson) : undefined,
    quotedTweet: t.quotedTweetJson ? JSON.parse(t.quotedTweetJson) : undefined,
    thread: t.threadJson ? JSON.parse(t.threadJson) : undefined,
    parent: t.parentJson ? JSON.parse(t.parentJson) : undefined,
    article: t.articleJson ? JSON.parse(t.articleJson) : undefined,
  }));

  return NextResponse.json({
    success: true,
    data: { items, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } },
  });
}
