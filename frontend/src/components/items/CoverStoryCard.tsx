import { ItemData } from "../../types/api";
import { formatTimeAgo, formatScore } from "../../lib/api";
import { SaveButton } from "../save/SaveButton";

interface CoverStoryCardProps {
  item: ItemData;
}

export function CoverStoryCard({ item }: CoverStoryCardProps) {
  const timeAgo = formatTimeAgo(item.publishedAt || item.fetchedAt);
  const readerBenefit = item.filterJudgment?.readerBenefit;

  return (
    <article className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-blue-100">
      {/* Header with source and time */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-2">
          <SourceIcon type={item.source.type} />
          <span>{item.source.packId}</span>
        </div>
        <span>{timeAgo}</span>
      </div>

      {/* Title - Large and Prominent */}
      <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-700 transition-colors"
        >
          {item.title}
        </a>
      </h2>

      {/* Reader Benefit as Subtitle */}
      {readerBenefit && (
        <p className="text-lg text-blue-700 mb-4 font-medium">
          {readerBenefit}
        </p>
      )}

      {/* Snippet */}
      {item.snippet && (
        <p className="text-gray-600 text-base mb-4 line-clamp-3">{item.snippet}</p>
      )}

      {/* Author */}
      {item.author && (
        <p className="text-sm text-gray-500 mb-4">作者: {item.author}</p>
      )}

      {/* Footer with Score and Save Button */}
      <div className="flex items-center justify-between pt-4 border-t border-blue-100">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-blue-600">
            Score: {formatScore(item.score)}
          </span>
          <div className="flex gap-1">
            <ScoreBar label="时效" value={item.scores.freshness} />
            <ScoreBar label="热度" value={item.scores.engagement} />
            <ScoreBar label="权重" value={item.scores.sourceWeight} />
          </div>
        </div>
        <SaveButton itemId={item.id} saved={!!item.saved} />
      </div>

      {/* Tags */}
      {item.enrichment?.tags && item.enrichment.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.enrichment.tags.slice(0, 5).map((tag, i) => (
            <span
              key={i}
              className="px-3 py-1 bg-white text-blue-600 rounded-full text-sm shadow-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Key Points */}
      {item.enrichment?.keyPoints && item.enrichment.keyPoints.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 bg-white/50 rounded-lg p-3">
          <span className="font-medium text-gray-700">要点:</span>{" "}
          {item.enrichment.keyPoints.slice(0, 3).join(" · ")}
        </div>
      )}
    </article>
  );
}

function SourceIcon({ type }: { type: string }) {
  const iconMap: Record<string, string> = {
    rss: "📰",
    "json-feed": "📡",
    hn: "🅷",
    reddit: "💬",
    "github-trending": "⭐",
    "x-home": "🐦",
    "x-list": "📋",
    "x-bookmarks": "🔖",
  };

  return <span>{iconMap[type] || "📄"}</span>;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.min(100, value * 10);
  const color =
    percentage >= 70 ? "bg-green-400" : percentage >= 40 ? "bg-yellow-400" : "bg-gray-300";

  return (
    <div className="flex items-center gap-1" title={`${label}: ${value.toFixed(1)}`}>
      <div className={`w-10 h-2 rounded-full bg-gray-200 overflow-hidden`}>
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
