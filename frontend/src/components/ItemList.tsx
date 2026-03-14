import { ItemData } from "../types/api";
import { ItemCard } from "./ItemCard";

interface ItemListProps {
  items: ItemData[];
  loading?: boolean;
}

export function ItemList({ items, loading }: ItemListProps) {
  if (loading) {
    return (
      <div className="grid gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-gray-100 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-100 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">没有内容</h3>
        <p className="mt-1 text-sm text-gray-500">
          当前筛选条件下没有找到任何内容
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
