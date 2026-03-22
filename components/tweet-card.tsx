"use client"

import Image from "next/image"
import { Heart, MessageCircle, Repeat2, Bookmark, ExternalLink } from "lucide-react"
import { formatEngagement } from "@/lib/tweet-utils"
import type { Tweet } from "@/lib/types"
import { TweetMediaGallery } from "@/components/tweet-media-gallery"

interface TweetCardProps {
  tweet: Tweet
  isSaved: boolean
  onToggleSave: (id: string) => void
}

export function TweetCard({ tweet, isSaved, onToggleSave }: TweetCardProps) {
  return (
    <div className="border rounded-xl p-4 bg-card">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {tweet.authorHandle[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">
              {tweet.authorName || tweet.authorHandle}
            </div>
            <div className="text-xs text-muted-foreground">@{tweet.authorHandle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tweet.tab && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {tweet.tab}
            </span>
          )}
          <div className="text-xs text-muted-foreground">
            {tweet.publishedAt
              ? new Date(tweet.publishedAt).toLocaleDateString("zh-CN", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">{tweet.text}</div>

      {/* Media Gallery */}
      {tweet.media && tweet.media.length > 0 && (
        <TweetMediaGallery media={tweet.media} tweetUrl={tweet.url} />
      )}

      {/* Quoted Tweet */}
      {tweet.quotedTweet && (
        <a
          href={`https://x.com/${tweet.quotedTweet.authorHandle}/status/${tweet.quotedTweet.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block border rounded-lg p-2.5 mb-3 hover:bg-muted/50 transition-colors border-l-[3px] border-l-blue-500"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0">
              {tweet.quotedTweet.authorHandle[0]?.toUpperCase()}
            </div>
            <span className="text-xs font-medium truncate">
              {tweet.quotedTweet.authorName || tweet.quotedTweet.authorHandle}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              @{tweet.quotedTweet.authorHandle}
            </span>
          </div>
          <div className="text-xs leading-relaxed line-clamp-3 ml-[26px]">
            {tweet.quotedTweet.text}
          </div>
          {tweet.quotedTweet.article && (() => {
            const quotedMedia = tweet.quotedTweet.media;
            const quotedImageUrl = quotedMedia?.find((m) => m.type === "photo")?.url;
            return (
              <div className="ml-[26px] mt-2 border rounded-md overflow-hidden flex">
                {quotedImageUrl && (
                  <div className="w-20 h-20 shrink-0 relative">
                    <Image
                      src={quotedImageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-2 min-w-0">
                  <div className="text-xs font-medium line-clamp-2">
                    {tweet.quotedTweet.article.title}
                  </div>
                  {tweet.quotedTweet.article.previewText && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {tweet.quotedTweet.article.previewText}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          <div className="flex gap-3 mt-1.5 ml-[26px] text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Heart className="w-3 h-3" />
              {formatEngagement(tweet.quotedTweet.likeCount)}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="w-3 h-3" />
              {formatEngagement(tweet.quotedTweet.replyCount)}
            </span>
            <span className="flex items-center gap-0.5">
              <Repeat2 className="w-3 h-3" />
              {formatEngagement(tweet.quotedTweet.retweetCount)}
            </span>
          </div>
        </a>
      )}

      {/* Article Preview */}
      {tweet.article && (
        <a
          href={tweet.article.url || tweet.expandedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block border rounded-lg overflow-hidden mb-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex">
            {tweet.articleImageUrl && (
              <div className="w-24 h-24 shrink-0 relative">
                <Image
                  src={tweet.articleImageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                  loading="lazy"
                />
              </div>
            )}
            <div className="p-2.5 min-w-0">
              <div className="text-sm font-medium line-clamp-2">
                {tweet.article.title}
              </div>
              {tweet.article.previewText && (
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {tweet.article.previewText}
                </div>
              )}
            </div>
          </div>
        </a>
      )}

      {/* AI Section */}
      {(tweet.summary ||
        (tweet.bullets && tweet.bullets.length > 0) ||
        (tweet.categories && tweet.categories.length > 0)) && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-3 mb-3 border-l-[3px] border-l-blue-500">
          {tweet.summary && (
            <div>
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                AI 摘要
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {tweet.summary}
              </div>
            </div>
          )}
          {tweet.bullets && tweet.bullets.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                关键要点
              </div>
              {tweet.bullets.map((bullet, i) => (
                <div
                  key={i}
                  className="text-xs text-muted-foreground leading-relaxed"
                >
                  • {bullet}
                </div>
              ))}
            </div>
          )}
          {tweet.categories && tweet.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tweet.categories.map((cat) => (
                <span
                  key={cat}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Engagement Bar */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground pt-2.5 border-t">
        <span className="flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" />
          {formatEngagement(tweet.likeCount)}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" />
          {formatEngagement(tweet.replyCount)}
        </span>
        <span className="flex items-center gap-1">
          <Repeat2 className="w-3.5 h-3.5" />
          {formatEngagement(tweet.retweetCount)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onToggleSave(tweet.id)}
            className={`p-1 rounded-md transition-colors ${
              isSaved ? "text-blue-500" : "hover:bg-muted"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
          </button>
          <a
            href={tweet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
