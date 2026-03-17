import { ItemData } from "../../types/api";
import { CoverStoryCard } from "../items/CoverStoryCard";

interface CoverStorySectionProps {
  item: ItemData | null;
}

export function CoverStorySection({ item }: CoverStorySectionProps) {
  if (!item) {
    return (
      <section className="bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-gray-500">暂无封面故事</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">封面故事</h2>
      <CoverStoryCard item={item} />
    </section>
  );
}
