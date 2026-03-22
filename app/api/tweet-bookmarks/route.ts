import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeJsonParse<T>(json: string | null | undefined): T | undefined {
  if (!json) return undefined;
  try { return JSON.parse(json) as T; } catch { return undefined; }
}

export async function GET() {
  try {
    const bookmarks = await prisma.tweetBookmark.findMany({
      orderBy: { bookmarkedAt: "desc" },
      include: { tweet: true },
    });

    const items = bookmarks.map((b) => ({
      id: b.tweet.id,
      tweetId: b.tweet.tweetId,
      tab: b.tweet.tab,
      text: b.tweet.text,
      url: b.tweet.url,
      expandedUrl: b.tweet.expandedUrl,
      publishedAt: b.tweet.publishedAt?.toISOString(),
      fetchedAt: b.tweet.fetchedAt.toISOString(),
      authorHandle: b.tweet.authorHandle,
      authorName: b.tweet.authorName,
      likeCount: b.tweet.likeCount,
      replyCount: b.tweet.replyCount,
      retweetCount: b.tweet.retweetCount,
      summary: b.tweet.summary,
      bullets: b.tweet.bullets,
      categories: b.tweet.categories,
      score: b.tweet.score,
      isBookmarked: true,
      bookmarkedAt: b.bookmarkedAt.toISOString(),
      media: safeJsonParse(b.tweet.mediaJson),
      quotedTweet: safeJsonParse(b.tweet.quotedTweetJson),
      thread: safeJsonParse(b.tweet.threadJson),
      parent: safeJsonParse(b.tweet.parentJson),
      article: safeJsonParse(b.tweet.articleJson),
    }));

    return NextResponse.json({
      success: true,
      data: { items, meta: { total: items.length } },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
