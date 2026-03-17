import { ItemData } from "../../types/api";
import { SaveButton } from "../save/SaveButton";

interface SavedForLaterSectionProps {
  items: ItemData[];
}

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚保存";
  if (diffMins < 60) return `${diffMins} 分钟前保存`;
  if (diffHours < 24) return `${diffHours} 小时前保存`;
  if (diffDays < 7) return `${diffDays} 天前保存`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " 保存";
}

export function SavedForLaterSection({ items }: SavedForLaterSectionProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-12 h-12 mx-auto mb-3 text-gray-300"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
          />
        </svg>
        <p>暂无保存的内容</p>
        <p className="text-sm mt-1">点击条目上的书签图标即可保存</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
            >
              {item.title}
            </a>
            {item.saved?.savedAt && (
              <p className="text-xs text-gray-400 mt-1">
                {formatSavedAt(item.saved.savedAt)}
              </p>
            )}
          </div>
          <SaveButton itemId={item.id} saved={true} />
        </div>
      ))}
    </section>
  );
}
