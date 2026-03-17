import { ItemData } from "../../types/api";
import { formatTimeAgo } from "../../lib/api";
import { SaveButton } from "../save/SaveButton";

interface ItemCardWithReasonProps {
  item: ItemData;
}

export function ItemCardWithReason({ item }: ItemCardWithReasonProps) {
  const timeAgo = formatTimeAgo(item.publishedAt || item.fetchedAt);
  const { filterJudgment, saved } = item;

  return (
    <article className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
      {/* Header: Title + Save Button */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-lg font-medium text-gray-900">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600"
          >
            {item.title}
          </a>
        </h3>
        <SaveButton
          itemId={item.id}
          packId={item.source.packId}
          saved={!!saved}
        />
      </div>

      {/* Meta Info */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <SourceIcon type={item.source.type} />
          <span>{item.source.packId}</span>
        </span>
        <span>{timeAgo}</span>
        {item.author && <span>作者: {item.author}</span>}
      </div>

      {/* Keep Reason Tag */}
      {filterJudgment?.keepReason && (
        <div className="mb-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {filterJudgment.keepReason}
          </span>
        </div>
      )}

      {/* Reader Benefit */}
      {filterJudgment?.readerBenefit && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800">
          <span className="font-medium">读者收益: </span>
          {filterJudgment.readerBenefit}
        </div>
      )}

      {/* Reading Hint */}
      {filterJudgment?.readingHint && (
        <div className="mt-2 text-xs text-gray-500 italic">
          提示: {filterJudgment.readingHint}
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
    github_trending: "⭐",
    x_home: "🐦",
    x_list: "📋",
    x_bookmarks: "🔖",
  };

  return <span>{iconMap[type] || "📄"}</span>;
}
