import { ItemData } from "../../types/api";
import { LeadStoryCard } from "../items/LeadStoryCard";

interface LeadStoriesSectionProps {
  items: ItemData[];
}

export function LeadStoriesSection({ items }: LeadStoriesSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      {items.map((item) => (
        <LeadStoryCard key={item.id} item={item} />
      ))}
    </section>
  );
}
