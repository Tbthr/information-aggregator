import { ItemData } from "../../types/api";
import { SignalCard } from "../items/SignalCard";

interface TopSignalsSectionProps {
  items: ItemData[];
}

/**
 * TopSignalsSection - Top Signals 区域容器组件
 * 使用 SignalCard 渲染紧凑卡片列表
 */
export function TopSignalsSection({ items }: TopSignalsSectionProps) {
  if (items.length === 0) {
    return (
      <section className="text-gray-500 text-sm py-4">
        暂无高价值信号
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {items.map((item) => (
        <SignalCard key={item.id} item={item} />
      ))}
    </section>
  );
}
