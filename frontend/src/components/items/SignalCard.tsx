import { ItemData } from "../../types/api";
import { SaveButton } from "../save/SaveButton";

interface SignalCardProps {
  item: ItemData;
}

/**
 * SignalCard - 紧凑卡片组件，用于 Top Signals 区域
 * 显示 keepReason 作为标签，包含 SaveButton
 */
export function SignalCard({ item }: SignalCardProps) {
  return (
    <article className="bg-amber-50 border border-amber-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        {/* 标题 */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 text-sm">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600"
            >
              {item.title}
            </a>
          </h3>
          {/* keepReason 标签 */}
          {item.filterJudgment?.keepReason && (
            <span className="inline-block mt-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
              {item.filterJudgment.keepReason}
            </span>
          )}
        </div>
        {/* 保存按钮 */}
        <SaveButton itemId={item.id} saved={!!item.saved} />
      </div>
    </article>
  );
}
