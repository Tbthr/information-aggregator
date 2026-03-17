import { ScanBriefItem } from "../../types/api";

interface ScanBriefSectionProps {
  items: ScanBriefItem[];
}

export function ScanBriefSection({ items }: ScanBriefSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 text-sm py-1 border-b border-gray-100 last:border-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-gray-800 hover:text-blue-600 truncate"
          >
            {item.title}
          </a>
          <span className="text-xs text-gray-400 shrink-0">#{item.score.toFixed(1)}</span>
        </div>
      ))}
    </section>
  );
}
