import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
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
    media: b.tweet.mediaJson ? JSON.parse(b.tweet.mediaJson) : undefined,
    quotedTweet: b.tweet.quotedTweetJson ? JSON.parse(b.tweet.quotedTweetJson) : undefined,
    thread: b.tweet.threadJson ? JSON.parse(b.tweet.threadJson) : undefined,
    parent: b.tweet.parentJson ? JSON.parse(b.tweet.parentJson) : undefined,
    article: b.tweet.articleJson ? JSON.parse(b.tweet.articleJson) : undefined,
  }));

  return NextResponse.json({
    success: true,
    data: { items, meta: { total: items.length } },
  });
}
