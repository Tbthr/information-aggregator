interface PaginationProps {
  current: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ current, total, onChange }: PaginationProps) {
  const pages = getPageNumbers(current, total);

  return (
    <nav className="flex items-center justify-center gap-1">
      {/* Previous */}
      <button
        onClick={() => onChange(current - 1)}
        disabled={current <= 1}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        上一页
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pages.map((page, i) =>
          page === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onChange(page as number)}
              className={`w-8 h-8 text-sm rounded ${
                current === page
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {page}
            </button>
          )
        )}
      </div>

      {/* Next */}
      <button
        onClick={() => onChange(current + 1)}
        disabled={current >= total}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        下一页
      </button>
    </nav>
  );
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push("...");
  }

  // Pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  // Always show last page
  if (total > 1) {
    pages.push(total);
  }

  return pages;
}
