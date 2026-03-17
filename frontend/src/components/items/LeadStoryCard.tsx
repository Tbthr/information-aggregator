import { ItemData } from "../../types/api";
import { SaveButton } from "../save/SaveButton";

interface LeadStoryCardProps {
  item: ItemData;
}

export function LeadStoryCard({ item }: LeadStoryCardProps) {
  return (
    <article className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 border border-gray-100">
      <div className="flex items-start justify-between gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Reading Hint Badge */}
          {item.filterJudgment?.readingHint && (
            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded mb-2">
              {item.filterJudgment.readingHint}
            </span>
          )}

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
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <SourceIcon type={item.source.type} />
              <span>{item.source.packId}</span>
            </span>
            {item.author && <span>作者: {item.author}</span>}
          </div>
        </div>

        {/* Save Button */}
        <SaveButton itemId={item.id} saved={!!item.saved} />
      </div>
    </article>
  );
}

function SourceIcon({ type }: { type: string }) {
  const iconMap: Record<string, string> = {
    rss: "📰",
    "json-feed": "📡",
    hn: "🅷",
    reddit: "💬",
    github_trending: "⭐",
    x_home: "🐦",
    x_list: "📋",
    x_bookmarks: "🔖",
  };

  return <span>{iconMap[type] || "📄"}</span>;
}
