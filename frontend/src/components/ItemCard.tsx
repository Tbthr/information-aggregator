import { ItemData } from "../types/api";
import { formatTimeAgo, formatScore } from "../lib/api";

interface ItemCardProps {
  item: ItemData;
}

export function ItemCard({ item }: ItemCardProps) {
  const timeAgo = formatTimeAgo(item.publishedAt || item.fetchedAt);

  return (
    <article className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
      {/* Title */}
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-600"
        >
          {item.title}
        </a>
      </h3>

      {/* Snippet */}
      {item.snippet && (
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.snippet}</p>
      )}

      {/* Meta Info */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <SourceIcon type={item.source.type} />
          <span>{item.source.packId}</span>
        </span>
        <span>{timeAgo}</span>
        {item.author && <span>作者: {item.author}</span>}
      </div>

      {/* Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-600">
            Score: {formatScore(item.score)}
          </span>
          <div className="flex gap-1">
            <ScoreBar label="时效" value={item.scores.freshness} />
            <ScoreBar label="热度" value={item.scores.engagement} />
            <ScoreBar label="权重" value={item.scores.sourceWeight} />
          </div>
        </div>
      </div>

      {/* Tags */}
      {item.enrichment?.tags && item.enrichment.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {item.enrichment.tags.slice(0, 5).map((tag, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Key Points */}
      {item.enrichment?.keyPoints && item.enrichment.keyPoints.length > 0 && (
        <div className="mt-3 text-xs text-gray-500">
          <span className="font-medium">要点:</span>{" "}
          {item.enrichment.keyPoints.slice(0, 2).join(" · ")}
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
      <div className={`w-8 h-1.5 rounded-full bg-gray-200 overflow-hidden`}>
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
